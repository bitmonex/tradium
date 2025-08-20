// chart-core.js

import { ChartConfig }       from './chart-config.js';
import { createLayout }      from './chart-layout.js';
import { FPS }               from './chart-fps.js';
import { OHLCV }             from './chart-ohlcv.js';
import { ChartScales }       from './chart-scale.js';
import { renderGrid }        from './chart-grid-render.js';
import { Mouse }             from './chart-mouse.js';
import { Indicators }        from './chart-indicators.js';
import { zoomX, zoomY, pan } from './chart-zoom.js';

export function createChartCore(container) {
  const state = {
    scaleX:    1,
    scaleY:    1,
    offsetX:   0,
    offsetY:   150,
    candles:   [],
    ohlcv:     null,
    indicator: null,
    layout:    null
  };

  let sprites  = [];
  let lastKey  = '';
  let scales   = null;

  // инициализация PIXI
  const app = new PIXI.Application({
    resizeTo:        container,
    backgroundColor: +ChartConfig.default.chartBG,
    antialias:       true,
    autoDensity:     true
  });
  app.stage.sortableChildren = true;
  container.appendChild(app.view);

  // глобальные настройки
  const settings = window.chartSettings || {};
  const config = {
    ...ChartConfig,
    candleWidth:  5,
    spacing:      2,
    minScaleX:    0.05,
    maxScaleX:    40,
    minScaleY:    0.1,
    maxScaleY:    40,
    rightOffset:  70,
    bottomOffset: 30
  };

  // слои: свечи, маска, шкалы
  const group = new PIXI.Container();
  group.sortableChildren = true;
  app.stage.addChild(group);

  const candleLayer = new PIXI.Container();
  candleLayer.zIndex = 10;
  group.addChild(candleLayer);

  const mask = new PIXI.Graphics();
  group.mask = mask;
  app.stage.addChild(mask);

  const scalesContainer = new PIXI.Container();
  scalesContainer.zIndex = 20;
  app.stage.addChild(scalesContainer);

  // рисуем свечи
  function drawCandles() {
    const c = state.candles;
    if (!c.length) return;

    const { width, height } = app.renderer;
    const cw = (config.candleWidth + config.spacing) * state.scaleX;
    const prices = c.flatMap(v => [v.open, v.high, v.low, v.close]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const key = [state.scaleX, state.scaleY, state.offsetX, state.offsetY, c.length].join('_');
    if (key === lastKey) return;
    lastKey = key;

    while (sprites.length < c.length) {
      const g = new PIXI.Graphics();
      g.zIndex = 10;
      sprites.push(g);
      candleLayer.addChild(g);
    }

    c.forEach((v, i) => {
      const g = sprites[i];
      const x = i * cw + state.offsetX;
      if (x + config.candleWidth < 0 || x > width - config.rightOffset) {
        g.visible = false;
        return;
      }

      const mapY = val =>
        ((height - config.bottomOffset) * (1 - (val - min) / range)) *
          state.scaleY +
        state.offsetY;

      const col = v.close >= v.open
        ? +ChartConfig.candles.candleBull
        : +ChartConfig.candles.candleBear;

      g.clear();
      g.visible = true;
      g.lineStyle(1, col);
      g.beginFill(col);
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

  // создаёт или обновляет шкалы (только пересчитывает координаты)
  function updateScales() {
    const L = createLayout(
      app,
      config,
      state.candles,
      state.offsetX,
      state.offsetY,
      state.scaleX,
      state.scaleY
    );
    state.layout = L;

    if (!scales) {
      scales = new ChartScales(scalesContainer, L, config);
    } else {
      scales.layout   = L;
      scales.settings = config;
    }
    scales.update();
  }

  // отрисовка сетки и шкал + свечей
  function render() {
    if (!state.candles.length) return;

    const L = createLayout(
      app,
      config,
      state.candles,
      state.offsetX,
      state.offsetY,
      state.scaleX,
      state.scaleY,
      group
    );
    state.layout = L;

    drawCandles();
    renderGrid(app, L, settings);
    updateScales();  // обновляем координаты шкал при каждом render

    mask.clear();
    mask.beginFill(0x000000);
    mask.drawRect(
      0,
      0,
      L.width - config.rightOffset,
      L.height - config.bottomOffset
    );
    mask.endFill();

    state.indicator?.render?.(L);
  }

  // загрузка новых данных
  function draw(data) {
    state.candles = data;

    if (ChartConfig.ohlcv?.ohlcvOn && data.length) {
      state.ohlcv = OHLCV({ ...config, group, chartSettings: settings }, data);
      state.ohlcv.render(data.at(-1));
    }

    // центрируем свечи вправо
    const cw = (config.candleWidth + config.spacing) * state.scaleX;
    state.offsetX = app.renderer.width - config.rightOffset - data.length * cw;
    state.offsetY = app.renderer.height / 2.8;

    state.indicator = Indicators({ group, app, config, candles: data });
    const initL = createLayout(
      app,
      config,
      data,
      state.offsetX,
      state.offsetY,
      state.scaleX,
      state.scaleY
    );
    state.layout = initL;
    state.indicator.init(initL);
    if (ChartConfig.indicators.indicatorsEnabled) {
      state.indicator.render(initL);
    }

    updateScales();  // рассчитываем тики один раз при загрузке данных
    render();
  }

  // обновление последней свечи
  function update(candle) {
    state.ohlcv?.update?.(candle);
  }

  const mouse = Mouse(app, config, state, { zoomX, zoomY, pan, render, update });
  mouse.init();

  if (ChartConfig.fps?.fpsOn) {
    new FPS(app.stage);
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    app.renderer.resize(width, height);
    app.view.style.width  = width  + 'px';
    app.view.style.height = height + 'px';

    updateScales();  // обновляем координаты шкал
    render();
  }
  window.addEventListener('resize', resize);

  function destroy() {
    mouse.destroy();
    window.removeEventListener('resize', resize);
    app.destroy(true, { children: true });
  }

  return {
    draw,
    updateScales,
    update,
    resize,
    destroy,
    zoomX,
    zoomY,
    pan,
    app
  };
}
