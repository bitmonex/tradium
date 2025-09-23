//chart-core.js
import { createLayout } from './chart-layout.js';
import { TF } from './chart-tf.js';
import { Grid } from './chart-grid-render.js';
import { OHLCV } from './chart-ohlcv.js';
import { FPS } from './chart-fps.js';
import { Mouse } from './chart-mouse.js';
import { zoomX, zoomY, pan } from './chart-zoom.js';
import { ChartConfig } from './chart-config.js';
import { LivePrice } from './chart-live.js';
import { updateLastCandle } from './chart-candles.js';
import { createIndicatorsManager } from './chart-indicators.js';

export async function createChartCore(container, userConfig = {}) {
  const fullConfig = { ...ChartConfig, ...userConfig };
  const { default: defStyles, modules, exchange, marketType, symbol, ...sections } = fullConfig;
  const config = { ...defStyles, ...sections.candles, ...sections.grid, ...sections.ohlcv, ...sections.fps,
    livePrice: sections.livePrice || ChartConfig.livePrice, candleWidth: 5, spacing: 2, rightOffset: 70, bottomOffset: 30,
    minScaleX: 0.05, maxScaleX: 40, minScaleY: 0.1, maxScaleY: 40, modules, indicators: fullConfig.indicators || [] };
  const chartSettings = { exchange, marketType, symbol };

  const app = new PIXI.Application();
  await app.init({ resizeTo: container, background: +config.chartBG, antialias: true, autoDensity: true });
  app.stage.sortableChildren = true; container.appendChild(app.view);

  const state = { candles: [], volumes: [], timeframe: 0, offsetX: 0, offsetY: 150, scaleX: 1, scaleY: 1,
    layout: null, ohlcv: null, fps: null, isFirstAutoCenter: true, userHasPanned: false, _needRedrawCandles: false, _liveOverride: null,
    graphGroup: null, subGroup: null };

  const graphGroup = new PIXI.Container(); graphGroup.sortableChildren = true; app.stage.addChild(graphGroup);
  const subGroup = new PIXI.Container(); subGroup.sortableChildren = true; app.stage.addChild(subGroup);
  const mask = new PIXI.Graphics(); graphGroup.mask = mask; app.stage.addChild(mask);
  state.graphGroup = graphGroup; state.subGroup = subGroup;

  let candleLayer; if (modules.candles) { candleLayer = new PIXI.Container(); candleLayer.zIndex = 10; graphGroup.addChild(candleLayer); }
  if (modules.ohlcv) { state.ohlcv = OHLCV({ config, chartSettings, group: graphGroup }); state.ohlcv.init(state.candles, state.volumes); }
  if (modules.fps) state.fps = new FPS(app.stage, config.fpsColor);

  let sprites = [], lastKey = '';
  const applyAutoCenter = (candles, volumes, init) => {
    state.candles = candles; state.volumes = volumes; state.timeframe = TF(candles);
    if (init && state.isFirstAutoCenter && !state.userHasPanned) {
      const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]),
            min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1,
            cw = (config.candleWidth + config.spacing) * state.scaleX,
            centerX = app.renderer.width / 2, lastIdx = candles.length - 1,
            halfW = (config.candleWidth * state.scaleX) / 2;
      state.offsetX = centerX - lastIdx * cw - halfW;
      const lastC = candles[lastIdx].close, ratio = 1 - (lastC - min) / range,
            bo = (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0),
            plotH = app.renderer.height - bo;
      state.offsetY = app.renderer.height / 2 - ratio * plotH * state.scaleY;
    }
  };

  const drawCandlesOnly = () => { if (!candleLayer || !state.candles.length || !app?.renderer) return;
    if (state._liveOverride && state.candles.length) { const last = state.candles.at(-1), p = state._liveOverride.price;
      if (typeof p === 'number' && isFinite(p)) { last.close = p; if (p > last.high) last.high = p; if (p < last.low) last.low = p; } }
    const { width, height } = app.renderer, cw = (config.candleWidth + config.spacing) * state.scaleX;
    const prices = state.candles.flatMap(v => [v.open, v.high, v.low, v.close]), min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
    const key = [state.scaleX, state.scaleY, state.offsetX, state.offsetY, state.candles.length, width, height].join('_');
    if (key === lastKey && !state._needRedrawCandles) return; lastKey = key;
    const startIdx = Math.max(0, Math.floor((-state.offsetX) / cw) - 2), endIdx = Math.min(state.candles.length, Math.ceil((width - config.rightOffset - state.offsetX) / cw) + 2);
    while (sprites.length < state.candles.length) { const g = new PIXI.Graphics(); g.zIndex = 10; sprites.push(g); candleLayer.addChild(g); }
    for (let i = 0; i < sprites.length; i++) sprites[i].visible = i >= startIdx && i < endIdx;
    const plotH = state.layout?.plotH ?? (height - config.bottomOffset), mapY = val => (plotH * (1 - (val - min) / range)) * state.scaleY + state.offsetY;
    for (let i = startIdx; i < endIdx; i++) { const v = state.candles[i], g = sprites[i], x = i * cw + state.offsetX, color = v.close >= v.open ? +config.candleBull : +config.candleBear;
      g.clear().visible = true; g.rect(x, Math.min(mapY(v.open), mapY(v.close)), config.candleWidth * state.scaleX, Math.max(1, Math.abs(mapY(v.close) - mapY(v.open)))).fill(color);
      g.moveTo(x + (config.candleWidth * state.scaleX) / 2, mapY(v.high)).lineTo(x + (config.candleWidth * state.scaleX) / 2, mapY(v.low)).stroke({ width: 1, color }); }
    state._needRedrawCandles = false; };

  const createFullLayout = bo => { const base = createLayout(app, config, state.candles, state.offsetX, state.offsetY, state.scaleX, state.scaleY, state.timeframe);
    return { ...base, candles: state.candles, volumes: state.volumes, config, offsetX: state.offsetX, offsetY: state.offsetY, scaleX: state.scaleX, scaleY: state.scaleY,
      timeframe: state.timeframe, plotX: 0, plotY: 0, plotW: base.width - config.rightOffset, plotH: base.height - bo }; };

  const renderAll = () => {
    if (!state.candles.length) return;
    const bo = (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0),
          layout = createFullLayout(bo);
    state.layout = layout; subGroup.y = layout.plotH;
    //if (!state.debugFill) { state.debugFill = new PIXI.Graphics(); state.debugFill.zIndex = 9999; app.stage.addChild(state.debugFill); }
    //state.debugFill.clear().beginFill(0xff0000, 0.3).drawRect(0, 0, layout.plotW, layout.plotH).endFill();
    if (modules.grid) Grid(app, layout, config);
    if (modules.candles) drawCandlesOnly();
    if (modules.ohlcv) state.ohlcv.render(state.candles.at(-1));
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
    if (modules.indicators && chartCore.indicators) chartCore.indicators.renderAll(layout);
    mask.clear().rect(0, 0, layout.plotW, layout.plotH).fill(0x000000);
  };

  const renderLight = () => {
    if (!state.candles.length) return;
    const bo = (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0);
    const layout = createFullLayout(bo);
    state.layout = layout;
    drawCandlesOnly();
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
    if (modules.indicators && chartCore.indicators) chartCore.indicators.renderAll(layout);
  };

  const redrawLayoutOnly = () => { if (!state.candles.length) return;
    const bo = Math.max(config.bottomOffset, chartCore.indicators?.getBottomStackHeight?.() || 0), layout = createFullLayout(bo); state.layout = layout;
    drawCandlesOnly(); if (modules.livePrice && state.livePrice) state.livePrice.render(layout); if (modules.indicators && chartCore.indicators) chartCore.indicators.renderAll(layout); };

const draw = async ({ candles, volumes }) => {
  const init = state.candles.length === 0;

  // Считаем всё сразу с учётом индикаторов
  applyAutoCenter(candles, volumes, init);
  state.layout = createFullLayout(
    (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0)
  );

  // Быстрый рендер свечей
  drawCandlesOnly();

  // Запускаем загрузку шрифтов
  const fontSpec = `${config.chartFontSize}px ${config.chartFont}`;
  await document.fonts.load(fontSpec);

  // Когда шрифты готовы — рендерим всё остальное
  if (modules.ohlcv) {
    state.ohlcv.init(candles, volumes);
    state.ohlcv.render(candles.at(-1));
  }
  renderAll();

  if (
    chartCore._lastCandleData &&
    chartCore._lastCandleData.openTime === state.candles.at(-1)?.openTime &&
    chartCore._lastCandleData.timeframe === state.timeframe
  ) {
    updateLastCandle(chartCore._lastCandleData);
    if (Array.isArray(state.volumes))
      state.volumes[state.volumes.length - 1] = chartCore._lastCandleData.volume;
    drawCandlesOnly();
    if (modules.livePrice && state.livePrice)
      state.livePrice.render(state.layout);
    if (modules.indicators && chartCore.indicators && state.layout)
      chartCore.indicators.renderAll(state.layout);
    chartCore._lastCandleData = null;
  }

  if (init) state.isFirstAutoCenter = false;
};

  const onHoverFiltered = candle => {
    const L = state.layout;
    if (!L || L.plotX == null) {
      if (modules.ohlcv) state.ohlcv.update(candle);
      return;
    }
    const mx = state.mouseX, my = state.mouseY;
    const inside = mx >= L.plotX && mx <= L.plotX + L.plotW && my >= L.plotY && my <= L.plotH;
    if (!inside) return;
    if (modules.ohlcv) state.ohlcv.update(candle);
  };

  const panWrapped = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return pan(...a); };
  const zoomXWrapped = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomX(...a); };
  const zoomYWrapped = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomY(...a); };

  const mouse = Mouse(app, config, state, {
    zoomX: zoomXWrapped,
    zoomY: zoomYWrapped,
    pan: panWrapped,
    render: renderLight,
    update: onHoverFiltered,
    onPanEnd: () => renderAll()
  });
  mouse.init();

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    app.renderer.resize(width, height);
    app.view.style.width = width + 'px';
    app.view.style.height = height + 'px';
    renderAll();
  };

  const destroy = () => {
    if (!chartCore._alive) return;
    chartCore._alive = false;
    try { mouse?.destroy?.(); } catch {}
    try { chartCore.indicators?.destroy?.(); } catch {}
    if (chartCore._livePriceSocket) {
      try {
        chartCore._livePriceSocket.onmessage = null;
        chartCore._livePriceSocket.onclose = null;
        chartCore._livePriceSocket.close();
      } catch {}
      chartCore._livePriceSocket = null;
    }
    if (chartCore._candleSocket) {
      try {
        chartCore._candleSocket.onmessage = null;
        chartCore._candleSocket.onclose = null;
        chartCore._candleSocket.close();
      } catch {}
      chartCore._candleSocket = null;
    }
    if (app?.view?.parentNode) app.view.parentNode.removeChild(app.view);
    try { app?.destroy?.(true, { children: true, texture: true, baseTexture: true }); } catch {}
  };

  const updateLast = candle => {
    updateLastCandle(candle);
    if (Array.isArray(state.volumes))
      state.volumes[state.volumes.length - 1] = candle.volume;
    drawCandlesOnly();
    if (modules.livePrice && state.livePrice && state.layout)
      state.livePrice.render(state.layout);
    if (modules.indicators && chartCore.indicators && state.layout)
      chartCore.indicators.renderAll(state.layout);
  };

  const chartCore = {
    draw,
    resize,
    redrawLayoutOnly,
    drawCandlesOnly,
    zoomX: zoomXWrapped,
    zoomY: zoomYWrapped,
    pan: panWrapped,
    updateLast,
    app,
    config,
    state,
    graphGroup,
    subGroup,
    renderAll,
    renderLight,
    invalidateLight: () => { state._needRedrawCandles = true; renderLight(); },
    _alive: true
  };
  if (modules.indicators) {
    chartCore.indicators = createIndicatorsManager(chartCore);
    chartCore.indicators.initFromConfig(config.indicators || []);
  }
  if (modules.livePrice) {
    state.livePrice = LivePrice({ group: graphGroup, config, chartSettings, chartCore });
  }

  chartCore.destroy = destroy;
  return chartCore;
}