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

export function createChartCore(container, userConfig = {}) {
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
    ...sections.livePrice,

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

  // chartSettings передаём в OHLCV
  const chartSettings = { exchange, marketType, symbol };

  // 4) Инициализация PIXI
  const app = new PIXI.Application({
    resizeTo:       container,
    backgroundColor:+config.chartBG,
    antialias:      true,
    autoDensity:    true
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
    candles:    [],
    volumes:    [],
    timeframe:  0,
    offsetX:    0,
    offsetY:    150,
    scaleX:     1,
    scaleY:     1,
    layout:     null,
    ohlcv:      null,
    indicators: null,
    fps:        null
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
    state.livePrice = LivePrice({ group, config, chartSettings });
  }

  // вспомогательные переменные для отрисовки свечей
  let sprites = [];
  let lastKey = '';

  // 9) Функция рисует только свечи
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
      g.lineStyle(1, color);
      g.beginFill(color);
      g.drawRect(
        x,
        Math.min(mapY(v.open), mapY(v.close)),
        config.candleWidth * state.scaleX,
        Math.max(1, Math.abs(mapY(v.close) - mapY(v.open)))
      );
      g.endFill();

      const cx = x + (config.candleWidth * state.scaleX) / 2;
      g.moveTo(cx, mapY(v.high));
      g.lineTo(cx, mapY(v.low));
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
      
    mask.clear();
    mask.beginFill(0x000000);
    mask.drawRect(
      0,
      0,
      layout.width  - config.rightOffset,
      layout.height - config.bottomOffset
    );
    mask.endFill();
  }

    // 12) Приём новых данных и первая отрисовка
    function draw({ candles, volumes }) {
      // 1. Обновляем состояние
      state.candles   = candles;
      state.volumes   = volumes;
      state.timeframe = TF(candles);

      // 2. Вычисляем min/max и range для всех свечей
      const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
      const min    = Math.min(...prices);
      const max    = Math.max(...prices);
      const range  = max - min || 1;

      // 3. Центрируем последнюю свечу по горизонтали
      if (!app?.renderer) return;
      const cw       = (config.candleWidth + config.spacing) * state.scaleX;
      const centerX  = app.renderer.width  / 2;
      const lastIdx  = candles.length - 1;
      const halfW    = (config.candleWidth * state.scaleX) / 2;
      state.offsetX  = centerX - lastIdx * cw - halfW;

      // 4. Центрируем последнюю свечу по вертикали
      //    так, чтобы её closing price оказался в середине plot-области
      const lastC     = candles[lastIdx].close;
      const ratio     = 1 - (lastC - min) / range;         // 0→максимум внизу, 1→минимум вверху
      const H         = app.renderer.height;
      const plotH     = H - config.bottomOffset;
      state.offsetY   = H/2 - (ratio * plotH * state.scaleY);

      // 5. Рисуем только свечи
      drawCandlesOnly();

      // 6. Полная отрисовка модулей после загрузки шрифта
      function doDraw() {
        // повторяем расчёты на случай, если scaleX/scaleY сбросились
        state.candles   = candles;
        state.volumes   = volumes;
        state.timeframe = TF(candles);

        // горизонталь
        const cw2      = (config.candleWidth + config.spacing) * state.scaleX;
        const centerX2 = app.renderer.width  / 2;
        const lastIdx2 = candles.length - 1;
        const halfW2   = (config.candleWidth * state.scaleX) / 2;
        state.offsetX  = centerX2 - lastIdx2 * cw2 - halfW2;

        // vert
        const lastC2   = candles[lastIdx2].close;
        const ratio2   = 1 - (lastC2 - min) / range;
        const H2       = app.renderer.height;
        const plotH2   = H2 - config.bottomOffset;
        state.offsetY  = H2/2 - (ratio2 * plotH2 * state.scaleY);

        // OHLCV
        if (modules.ohlcv) {
          state.ohlcv.init(candles, volumes);
          state.ohlcv.render(candles[lastIdx2]);
        }

        renderAll();
      }

      // ждём загрузки шрифта, затем рисуем модули
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
  const mouse = Mouse(app, config, state, {
    zoomX, zoomY, pan,
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
      // если уже уничтожали — выходим
      if (!chartCore._alive) return;
      chartCore._alive = false;

      // 1) Снимаем обработчики мыши
      try { mouse?.destroy?.(); } 
      catch (e) { console.warn('[ChartCore] mouse destroy error', e); }

      // 2) Снимаем resize
      window.removeEventListener('resize', resize);

      // 3) Закрываем live‑сокет цен
      if (chartCore._livePriceSocket) {
        try {
          chartCore._livePriceSocket.onmessage = null;
          chartCore._livePriceSocket.onclose = null;
          chartCore._livePriceSocket.close();
        } catch (e) {
          console.warn('[ChartCore] live price socket close error', e);
        }
        chartCore._livePriceSocket = null;
      }

      // 4) Закрываем сокет свечей
      if (chartCore._candleSocket) {
        try {
          chartCore._candleSocket.onmessage = null;
          chartCore._candleSocket.onclose = null;
          chartCore._candleSocket.close();
        } catch (e) {
          console.warn('[ChartCore] candle socket close error', e);
        }
        chartCore._candleSocket = null;
      }

      // 5) Уничтожаем Pixi‑приложение
      try { app?.destroy?.(true, { children: true }); } 
      catch (e) { console.warn('[ChartCore] app destroy error', e); }
    }

    // 16) Обновление последней свечи без полного redraw
    function updateLast(candle) {
      updateLastCandle(candle);
      const volumes = chartCore.state.volumes;
      if (Array.isArray(volumes)) {
        volumes[volumes.length - 1] = candle.volume;
      }
    }

    // 17) Публичное API с замыканием на chartCore
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

    chartCore.destroy = function() {
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

      try { app?.destroy?.(true, { children: true }); } catch (e) { console.warn('[ChartCore] app destroy error', e); }
    };

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
    // 🔹 Не переподключаемся, если график уже уничтожен
    if (chartCore._alive) {
      setTimeout(() => initRealtimeCandles(chartCore, chartSettings), 1000);
    }
  };
}


