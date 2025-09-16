// chart-core.js
import { createLayout }      from './chart-layout.js';
import { TF }                from './chart-tf.js';
import { Grid }              from './chart-grid-render.js';
import { OHLCV }             from './chart-ohlcv.js';
import { Indicators }        from './chart-indicators.js';
import { FPS }               from './chart-fps.js';
import { Mouse }             from './chart-mouse.js';
import { zoomX, zoomY, pan } from './chart-zoom.js';
import { ChartConfig }       from './chart-config.js';
import { LivePrice }         from './chart-live.js';
import { updateLastCandle }  from './chart-candles.js';

// @param {HTMLElement} container – DOM-элемент для PIXI Canvas
// @param {object} userConfig – объект, расширяющий ChartConfig
export async function createChartCore(container, userConfig = {}) {
  const fullConfig = { ...ChartConfig, ...userConfig };
  const {
    default: defStyles,
    modules,
    exchange,
    marketType,
    symbol,
    ...sections
  } = fullConfig;

  const config = {
    ...defStyles,
    ...sections.candles,
    ...sections.grid,
    ...sections.ohlcv,
    ...sections.indicators,
    ...sections.fps,
    livePrice: sections.livePrice || ChartConfig.livePrice,

    candleWidth:  5,
    spacing:      2,
    rightOffset:  70,
    bottomOffset: 30,

    minScaleX:    0.05,
    maxScaleX:    40,
    minScaleY:    0.1,
    maxScaleY:    40,

    modules
  };

  // chartSettings передаём в OHLCV и LivePrice
  const chartSettings = { exchange, marketType, symbol };

  // 4) Инициализация PIXI (v8: через init)
  const app = new PIXI.Application();
  await app.init({
    resizeTo:        container,
    background:     +config.chartBG, // v8: background
    antialias:       true,
    autoDensity:     true
  });
  app.stage.sortableChildren = true;
  container.appendChild(app.view);

  // 5) Группа и маска для вьюпорта
  const group = new PIXI.Container();
  group.sortableChildren = true;
  app.stage.addChild(group);

  const mask = new PIXI.Graphics();
  group.mask = mask;
  app.stage.addChild(mask);

  // 6) Состояние чарта
  const state = {
    candles:          [],
    volumes:          [],
    timeframe:        0,
    offsetX:          0,
    offsetY:          150,
    scaleX:           1,
    scaleY:           1,
    layout:           null,
    ohlcv:            null,
    indicators:       null,
    fps:              null,

    // флаги автоцентрирования
    isFirstAutoCenter: true,  // центрировать только при первой загрузке
    userHasPanned:     false  // пользователь уже перетаскивал или масштабировал
  };

  // 7) Контейнер под свечи
  let candleLayer;
  if (modules.candles) {
    candleLayer = new PIXI.Container();
    candleLayer.zIndex = 10;
    group.addChild(candleLayer);
  }

  // 8) Инициализация подключаемых модулей
  if (modules.ohlcv) {
    state.ohlcv = OHLCV({ config, chartSettings, group });
    state.ohlcv.init(state.candles, state.volumes);
  }
  if (modules.indicators) {
    state.indicators = Indicators({ group, config });
  }
  if (modules.fps) {
    state.fps = new FPS(app.stage, config.fpsColor);
  }
  if (modules.livePrice) {
    state.livePrice = LivePrice({ group, config, chartSettings, chartCore: null });
  }

  // вспомогательные переменные для отрисовки свечей
  let sprites = [];
  let lastKey = '';

  // 9) Функция рисует только свечи (Graphics API обновлён под v8)
  function drawCandlesOnly() {
    if (!candleLayer || !state.candles.length) return;
    if (!app?.renderer) return;

    const { width, height } = app.renderer;
    const cw = (config.candleWidth + config.spacing) * state.scaleX;

    const prices = state.candles.flatMap(v => [v.open, v.high, v.low, v.close]);
    const min    = Math.min(...prices);
    const max    = Math.max(...prices);
    const range  = max - min || 1;

    const key = [
      state.scaleX, state.scaleY,
      state.offsetX, state.offsetY,
      state.candles.length
    ].join('_');
    if (key === lastKey) return;
    lastKey = key;

    while (sprites.length < state.candles.length) {
      const g = new PIXI.Graphics();
      g.zIndex = 10;
      sprites.push(g);
      candleLayer.addChild(g);
    }

    state.candles.forEach((v, i) => {
      const g = sprites[i];
      const x = i * cw + state.offsetX;

      if (x + config.candleWidth < 0 || x > width - config.rightOffset) {
        g.visible = false;
        return;
      }

      const mapY = val =>
        ((height - config.bottomOffset) * (1 - (val - min) / range))
        * state.scaleY + state.offsetY;

      const color = v.close >= v.open
        ? +config.candleBull
        : +config.candleBear;

      g.clear();
      g.visible = true;

      // тело свечи
      const bodyX = x;
      const bodyY = Math.min(mapY(v.open), mapY(v.close));
      const bodyH = Math.max(1, Math.abs(mapY(v.close) - mapY(v.open)));
      const bodyW = config.candleWidth * state.scaleX;

      g.rect(bodyX, bodyY, bodyW, bodyH).fill(color);

      // тень
      const cx = x + (config.candleWidth * state.scaleX) / 2;
      g.moveTo(cx, mapY(v.high)).lineTo(cx, mapY(v.low)).stroke({ width: 1, color });
    });
  }

  // 10) Универсальная сборка полного layout
  function createFullLayout() {
    const raw = createLayout(
      app,
      config,
      state.candles,
      state.offsetX,
      state.offsetY,
      state.scaleX,
      state.scaleY,
      state.timeframe
    );
    return {
      ...raw,
      candles:   state.candles,
      volumes:   state.volumes,
      config,
      offsetX:   state.offsetX,
      offsetY:   state.offsetY,
      scaleX:    state.scaleX,
      scaleY:    state.scaleY,
      timeframe: state.timeframe
    };
  }

  // 11) Полный рендер всех элементов
  function renderAll() {
    if (!state.candles.length) return;

    const layout = createFullLayout();
    state.layout = layout;

    if (modules.grid)       Grid(app, layout, config);
    if (modules.candles)    drawCandlesOnly();
    if (modules.ohlcv)      state.ohlcv.render(state.candles.at(-1));
    if (modules.indicators) { state.indicators.add(layout); state.indicators.render(layout); }
    if (modules.livePrice && state.livePrice) { state.livePrice.render(layout); }

    // Маска (Graphics API v8)
    mask.clear();
    mask.rect(
      0,
      0,
      layout.width  - config.rightOffset,
      layout.height - config.bottomOffset
    ).fill(0x000000);
  }

  // 12) Приём новых данных и первая отрисовка (фикс автоцентрирования)
  function draw({ candles, volumes }) {
    const isInitialLoad = state.candles.length === 0;

    // обновляем состояние
    state.candles   = candles;
    state.volumes   = volumes;
    state.timeframe = TF(candles);

    // min/max для свечей
    const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const min    = Math.min(...prices);
    const max    = Math.max(...prices);
    const range  = max - min || 1;
    if (!app?.renderer) return;

    // центрирование только при первой загрузке и до пользовательской панировки
    if (isInitialLoad && state.isFirstAutoCenter && !state.userHasPanned) {
      const cw      = (config.candleWidth + config.spacing) * state.scaleX;
      const centerX = app.renderer.width  / 2;
      const lastIdx = candles.length - 1;
      const halfW   = (config.candleWidth * state.scaleX) / 2;
      state.offsetX = centerX - lastIdx * cw - halfW;

      const lastC   = candles[lastIdx].close;
      const ratio   = 1 - (lastC - min) / range;
      const H       = app.renderer.height;
      const plotH   = H - config.bottomOffset;
      state.offsetY = H/2 - (ratio * plotH * state.scaleY);
    }

    drawCandlesOnly();

    function doDraw() {
      // повтор обновления состояния (на случай изменения scale после font-load)
      state.candles   = candles;
      state.volumes   = volumes;
      state.timeframe = TF(candles);

      // повторное центрирование под тем же условием
      if (isInitialLoad && state.isFirstAutoCenter && !state.userHasPanned) {
        const cw2      = (config.candleWidth + config.spacing) * state.scaleX;
        const centerX2 = app.renderer.width  / 2;
        const lastIdx2 = candles.length - 1;
        const halfW2   = (config.candleWidth * state.scaleX) / 2;
        state.offsetX  = centerX2 - lastIdx2 * cw2 - halfW2;

        const lastC2   = candles[lastIdx2].close;
        const ratio2   = 1 - (lastC2 - min) / range;
        const H2       = app.renderer.height;
        const plotH2   = H2 - config.bottomOffset;
        state.offsetY  = H2/2 - (ratio2 * plotH2 * state.scaleY);
      }

      if (modules.ohlcv) {
        state.ohlcv.init(candles, volumes);
        state.ohlcv.render(candles[candles.length - 1]);
      }

      renderAll();

      // обновление последней свечи без redraw
      if (
        chartCore._lastCandleData &&
        chartCore._lastCandleData.openTime === chartCore.state.candles.at(-1)?.openTime &&
        chartCore._lastCandleData.timeframe === state.timeframe
      ) {
        chartCore.updateLast(chartCore._lastCandleData);
        renderAll();
        chartCore._lastCandleData = null;
      }

      // отключаем автоцентр после первой отрисовки
      if (isInitialLoad) {
        state.isFirstAutoCenter = false;
      }
    }

    const fontSpec = `${config.chartFontSize}px "${config.chartFont}"`;
    document.fonts
      .load(fontSpec)
      .then(doDraw)
      .catch(doDraw);
  }

  // 13) Hover-подсветка через мышь
  function onHover(candle) {
    if (modules.ohlcv)      state.ohlcv.update(candle);
    if (modules.indicators) state.indicators.render(state.layout);
  }

  // обёртки pan/zoom, чтобы отключать автоцентр при взаимодействии
  const panWrapped   = (...args) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return pan(...args); };
  const zoomXWrapped = (...args) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomX(...args); };
  const zoomYWrapped = (...args) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomY(...args); };

  const mouse = Mouse(app, config, state, {
    zoomX:  zoomXWrapped,
    zoomY:  zoomYWrapped,
    pan:    panWrapped,
    render: renderAll,
    update: onHover
  });
  mouse.init();

  // 14) Обработка ресайза
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    app.renderer.resize(width, height);
    app.view.style.width  = width  + 'px';
    app.view.style.height = height + 'px';
    renderAll();
  }
  window.addEventListener('resize', resize);

  // 15) Очистка и уничтожение
    function destroy() {
        if (!chartCore._alive) return;
        chartCore._alive = false;

        try { mouse?.destroy?.(); } catch (e) { console.warn('[ChartCore] mouse destroy error', e); }
        window.removeEventListener('resize', resize);

        if (chartCore._livePriceSocket) {
            try {
                chartCore._livePriceSocket.onmessage = null;
                chartCore._livePriceSocket.onclose = null;
                chartCore._livePriceSocket.close();
            } catch (e) { console.warn('[ChartCore] live price socket close error', e); }
            chartCore._livePriceSocket = null;
        }
        if (chartCore._candleSocket) {
            try {
                chartCore._candleSocket.onmessage = null;
                chartCore._candleSocket.onclose = null;
                chartCore._candleSocket.close();
            } catch (e) { console.warn('[ChartCore] candle socket close error', e); }
            chartCore._candleSocket = null;
        }

        // Удаляем canvas из DOM до уничтожения app
        if (app?.view && app.view.parentNode) {
            app.view.parentNode.removeChild(app.view);
        }

        try {
            app?.destroy?.(true, { children: true, texture: true, baseTexture: true });
        } catch (e) {
            console.warn('[ChartCore] app destroy error', e);
        }
    }


  // 16) Обновление последней свечи без полного redraw
  function updateLast(candle) {
    updateLastCandle(candle);
    const volumes = chartCore.state.volumes;
    if (Array.isArray(volumes)) {
      volumes[volumes.length - 1] = candle.volume;
    }
  }

  // 17) Публичное API
  const chartCore = {
    draw,
    resize,
    zoomX,
    zoomY,
    pan,
    updateLast,
    app,
    config,
    state,
    group,
    _alive: true
  };
  chartCore.destroy = destroy;

  return chartCore;
}


export function initRealtimeCandles(chartCore, chartSettings) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const url = `ws://localhost:5002/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);

  chartCore._candleSocket = ws;

  ws.onmessage = (event) => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(event.data);
      chartCore._lastCandleData = data; // запоминаем последнее сообщение

      const last = chartCore.state.candles.at(-1);
      if (last?.openTime === data.openTime || !data.isFinal) {
        chartCore.updateLast(data);
      }
    } catch (err) {
      console.warn('[RealtimeCandles] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[RealtimeCandles] Disconnected');
    if (chartCore._alive) {
      setTimeout(() => initRealtimeCandles(chartCore, chartSettings), 1000);
    }
  };
}
