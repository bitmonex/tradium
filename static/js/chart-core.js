//chart-core.js
import { createLayout } from './chart-layout.js';
import { TF } from './chart-tf.js';
import { Grid } from './chart-grid-render.js';
import { OHLCV } from './chart-ohlcv.js';
import { Indicators } from './chart-indicators.js';
import { FPS } from './chart-fps.js';
import { Mouse } from './chart-mouse.js';
import { zoomX, zoomY, pan } from './chart-zoom.js';
import { ChartConfig } from './chart-config.js';
import { LivePrice } from './chart-live.js';
import { updateLastCandle } from './chart-candles.js';

export async function createChartCore(container, userConfig = {}) {
  const fullConfig = { ...ChartConfig, ...userConfig };
  const { default: defStyles, modules, exchange, marketType, symbol, ...sections } = fullConfig;
  const config = {
    ...defStyles, ...sections.candles, ...sections.grid, ...sections.ohlcv, ...sections.indicators, ...sections.fps,
    livePrice: sections.livePrice || ChartConfig.livePrice,
    candleWidth: 5, spacing: 2, rightOffset: 70, bottomOffset: 30,
    minScaleX: 0.05, maxScaleX: 40, minScaleY: 0.1, maxScaleY: 40, modules
  };
  const chartSettings = { exchange, marketType, symbol };

  const app = new PIXI.Application();
  await app.init({ resizeTo: container, background: +config.chartBG, antialias: true, autoDensity: true });
  app.stage.sortableChildren = true;
  container.appendChild(app.view);

  const group = new PIXI.Container(); group.sortableChildren = true; app.stage.addChild(group);
  const mask = new PIXI.Graphics(); group.mask = mask; app.stage.addChild(mask);

  const state = {
    candles: [], volumes: [], timeframe: 0, offsetX: 0, offsetY: 150, scaleX: 1, scaleY: 1,
    layout: null, ohlcv: null, indicators: null, fps: null,
    isFirstAutoCenter: true, userHasPanned: false
  };

  let candleLayer;
  if (modules.candles) { candleLayer = new PIXI.Container(); candleLayer.zIndex = 10; group.addChild(candleLayer); }
  if (modules.ohlcv) { state.ohlcv = OHLCV({ config, chartSettings, group }); state.ohlcv.init(state.candles, state.volumes); }
  if (modules.indicators) state.indicators = Indicators({ group, config });
  if (modules.fps) state.fps = new FPS(app.stage, config.fpsColor);
  if (modules.livePrice) state.livePrice = LivePrice({ group, config, chartSettings, chartCore: null });

  let sprites = [], lastKey = '';

  const applyAutoCenter = (candles, volumes, isInitialLoad) => {
    state.candles = candles; state.volumes = volumes; state.timeframe = TF(candles);
    if (isInitialLoad && state.isFirstAutoCenter && !state.userHasPanned) {
      const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
      const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
      const cw = (config.candleWidth + config.spacing) * state.scaleX;
      const centerX = app.renderer.width / 2, lastIdx = candles.length - 1;
      const halfW = (config.candleWidth * state.scaleX) / 2;
      state.offsetX = centerX - lastIdx * cw - halfW;
      const lastC = candles[lastIdx].close, ratio = 1 - (lastC - min) / range;
      const H = app.renderer.height, plotH = H - config.bottomOffset;
      state.offsetY = H / 2 - (ratio * plotH * state.scaleY);
    }
  };

  const drawCandlesOnly = () => {
    if (!candleLayer || !state.candles.length || !app?.renderer) return;
    if (state._liveOverride && state.candles.length) {
      const last = state.candles.at(-1), p = state._liveOverride.price;
      if (typeof p === 'number' && isFinite(p)) {
        last.close = p; if (p > last.high) last.high = p; if (p < last.low) last.low = p;
      }
    }
    const { width, height } = app.renderer;
    const cw = (config.candleWidth + config.spacing) * state.scaleX;
    const prices = state.candles.flatMap(v => [v.open, v.high, v.low, v.close]);
    const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
    const key = [state.scaleX, state.scaleY, state.offsetX, state.offsetY, state.candles.length].join('_');
    if (key === lastKey && !state._needRedrawCandles) return; lastKey = key;
    while (sprites.length < state.candles.length) {
      const g = new PIXI.Graphics(); g.zIndex = 10; sprites.push(g); candleLayer.addChild(g);
    }
    state.candles.forEach((v, i) => {
      const g = sprites[i], x = i * cw + state.offsetX;
      if (x + config.candleWidth < 0 || x > width - config.rightOffset) { g.visible = false; return; }
      const mapY = val => ((height - config.bottomOffset) * (1 - (val - min) / range)) * state.scaleY + state.offsetY;
      const color = v.close >= v.open ? +config.candleBull : +config.candleBear;
      g.clear(); g.visible = true;
      g.rect(x, Math.min(mapY(v.open), mapY(v.close)), config.candleWidth * state.scaleX, Math.max(1, Math.abs(mapY(v.close) - mapY(v.open)))).fill(color);
      const cx = x + (config.candleWidth * state.scaleX) / 2;
      g.moveTo(cx, mapY(v.high)).lineTo(cx, mapY(v.low)).stroke({ width: 1, color });
    });
    state._needRedrawCandles = false;
  };

  const createFullLayout = () => ({
    ...createLayout(app, config, state.candles, state.offsetX, state.offsetY, state.scaleX, state.scaleY, state.timeframe),
    candles: state.candles, volumes: state.volumes, config,
    offsetX: state.offsetX, offsetY: state.offsetY, scaleX: state.scaleX, scaleY: state.scaleY, timeframe: state.timeframe
  });

  const renderAll = () => {
    if (!state.candles.length) return;
    const layout = createFullLayout(); state.layout = layout;
    if (modules.grid) Grid(app, layout, config);
    if (modules.candles) drawCandlesOnly();
    if (modules.ohlcv) state.ohlcv.render(state.candles.at(-1));
    if (modules.indicators) { state.indicators.add(layout); state.indicators.render(layout); }
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
    mask.clear().rect(0, 0, layout.width - config.rightOffset, layout.height - config.bottomOffset).fill(0x000000);
  };

  const renderLight = () => {
    if (!state.candles.length) return;
    const layout = createFullLayout(); state.layout = layout;
    drawCandlesOnly();
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
  };

  const draw = ({ candles, volumes }) => {
    const isInitialLoad = state.candles.length === 0;
    applyAutoCenter(candles, volumes, isInitialLoad);
    drawCandlesOnly();

    const doDraw = () => {
      applyAutoCenter(candles, volumes, isInitialLoad);
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
        chartCore.updateLast(chartCore._lastCandleData);
        renderAll();
        chartCore._lastCandleData = null;
      }
      if (isInitialLoad) state.isFirstAutoCenter = false;
    };

    const fontSpec = `${config.chartFontSize}px "${config.chartFont}"`;
    document.fonts.load(fontSpec).then(doDraw).catch(doDraw);
  };

  const onHover = candle => {
    if (modules.ohlcv) state.ohlcv.update(candle);
    if (modules.indicators) state.indicators.render(state.layout);
  };

  const panWrapped   = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return pan(...a); };
  const zoomXWrapped = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomX(...a); };
  const zoomYWrapped = (...a) => { state.userHasPanned = true; state.isFirstAutoCenter = false; return zoomY(...a); };

  const mouse = Mouse(app, config, state, {
    zoomX: zoomXWrapped, zoomY: zoomYWrapped, pan: panWrapped,
    render: renderAll, update: onHover
  });
  mouse.init();

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    app.renderer.resize(width, height);
    app.view.style.width = width + 'px';
    app.view.style.height = height + 'px';
    renderAll();
  };
  window.addEventListener('resize', resize);

  const destroy = () => {
    if (!chartCore._alive) return;
    chartCore._alive = false;
    try { mouse?.destroy?.(); } catch {}
    window.removeEventListener('resize', resize);

    if (chartCore._livePriceSocket) {
      try { chartCore._livePriceSocket.onmessage = null; chartCore._livePriceSocket.onclose = null; chartCore._livePriceSocket.close(); } catch {}
      chartCore._livePriceSocket = null;
    }
    if (chartCore._candleSocket) {
      try { chartCore._candleSocket.onmessage = null; chartCore._candleSocket.onclose = null; chartCore._candleSocket.close(); } catch {}
      chartCore._candleSocket = null;
    }
    if (app?.view?.parentNode) app.view.parentNode.removeChild(app.view);
    try { app?.destroy?.(true, { children: true, texture: true, baseTexture: true }); } catch {}
  };

  const updateLast = candle => {
    updateLastCandle(candle);
    if (Array.isArray(state.volumes)) state.volumes[state.volumes.length - 1] = candle.volume;
  };

  const chartCore = {
    draw, resize, zoomX, zoomY, pan, updateLast,
    app, config, state, group, _alive: true,
    renderAll, renderLight,
    invalidateLight: () => { state._needRedrawCandles = true; renderLight(); }
  };
  chartCore.destroy = destroy;

  return chartCore;
}

export function initRealtimeCandles(chartCore, chartSettings) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const url = `ws://localhost:5002/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);
  chartCore._candleSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);
      chartCore._lastCandleData = data;
      const last = chartCore.state.candles.at(-1);
      if (last?.openTime === data.openTime || !data.isFinal) chartCore.updateLast(data);
    } catch (err) {
      console.warn('[RealtimeCandles] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[RealtimeCandles] Disconnected');
    if (chartCore._alive) setTimeout(() => initRealtimeCandles(chartCore, chartSettings), 1000);
  };
}
