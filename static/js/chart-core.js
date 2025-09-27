// chart-core.js
import { createLayout } from './chart-layout.js';
import { TF } from './chart-tf.js';
import { Grid } from './chart-grid-render.js';
import { OHLCV } from './chart-ohlcv.js';
import { FPS } from './chart-fps.js';
import { Mouse } from './chart-mouse.js';
import { zoomX, zoomY, pan } from './chart-zoom.js';
import { ChartConfig } from './chart-config.js';
import { LivePrice } from './chart-live.js';
import { updateLastCandle, resetCandleCursor } from './chart-candles.js';
import { createIndicatorsManager } from './chart-indicators.js';

export async function createChartCore(container, userConfig = {}) {
  const fullConfig = { ...ChartConfig, ...userConfig };
  const { default: defStyles, modules, exchange, marketType, symbol, ...sections } = fullConfig;

  const config = {
    ...defStyles,
    ...sections.candles,
    ...sections.grid,
    ...sections.ohlcv,
    ...sections.fps,
    livePrice: sections.livePrice || ChartConfig.livePrice,
    candleWidth: 5,
    spacing: 2,
    rightOffset: 70,
    bottomOffset: 30,
    minScaleX: 0.05,
    maxScaleX: 40,
    minScaleY: 0.1,
    maxScaleY: 40,
    modules,
    indicators: fullConfig.indicators || []
  };

  const chartSettings = { exchange, marketType, symbol };

  const app = new PIXI.Application();
  await app.init({ resizeTo: container, background: +config.chartBG, antialias: true, autoDensity: true });
  app.stage.sortableChildren = true;
  container.appendChild(app.view);

  const state = {
    candles: [],
    volumes: [],
    timeframe: 0,
    offsetX: 0,
    offsetY: 150,
    scaleX: 1,
    scaleY: 1,
    layout: null,
    ohlcv: null,
    fps: null,
    isFirstAutoCenter: true,
    userHasPanned: false,
    _needRedrawCandles: false,
    _liveOverride: null,
    graphGroup: null,
    subGroup: null,
    chartStyle: 'candles', // "candles" | "line" | "heikin" | "bars"
    fastMode: true
  };

  const graphGroup = new PIXI.Container();
  graphGroup.sortableChildren = true;
  app.stage.addChild(graphGroup);

  const subGroup = new PIXI.Container();
  subGroup.sortableChildren = true;
  app.stage.addChild(subGroup);

  const mask = new PIXI.Graphics();
  graphGroup.mask = mask;
  app.stage.addChild(mask);

  state.graphGroup = graphGroup;
  state.subGroup = subGroup;

  let candleLayer;
  if (modules.candles) {
    candleLayer = new PIXI.Container();
    candleLayer.zIndex = 10;
    graphGroup.addChild(candleLayer);
  }

  if (modules.ohlcv) {
    state.ohlcv = OHLCV({ config, chartSettings, group: graphGroup });
    state.ohlcv.init(state.candles, state.volumes);
  }
  if (modules.fps) state.fps = new FPS(app.stage, config.fpsColor);

  // internal graphics pool for candles layer
  let sprites = [];
  let lastKey = '';
  let lastStyle = state.chartStyle;

  const destroyGraphicsArray = arr => {
    for (let i = 0; i < arr.length; i++) {
      try { arr[i]?.destroy?.({ children: true, texture: true, baseTexture: true }); } catch {}
    }
    arr.length = 0;
  };

  const clearPixiTextureCaches = () => {
    try {
      PIXI.utils.clearTextureCache();
      if (PIXI.utils.BaseTextureCache) Object.keys(PIXI.utils.BaseTextureCache).forEach(k => delete PIXI.utils.BaseTextureCache[k]);
      if (PIXI.utils.TextureCache) Object.keys(PIXI.utils.TextureCache).forEach(k => delete PIXI.utils.TextureCache[k]);
    } catch {}
  };

  const toHeikin = candles => {
    const res = [];
    if (!candles.length) return res;
    let prevOpen = candles[0].open;
    let prevClose = candles[0].close;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      res.push({ open: haOpen, high: haHigh, low: haLow, close: haClose, timestamp: c.timestamp });
      prevOpen = haOpen;
      prevClose = haClose;
    }
    return res;
  };

  const applyAutoCenter = (candles, volumes, init) => {
    state.candles = candles;
    state.volumes = volumes;
    state.timeframe = TF(candles);

    if (init && state.isFirstAutoCenter && !state.userHasPanned && candles.length) {
      const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = max - min || 1;

      const cw = (config.candleWidth + config.spacing) * state.scaleX;
      const centerX = app.renderer.width / 2;
      const lastIdx = candles.length - 1;
      const halfW = (config.candleWidth * state.scaleX) / 2;

      state.offsetX = centerX - lastIdx * cw - halfW;

      const lastC = candles[lastIdx].close;
      const ratio = 1 - (lastC - min) / range;
      const bo = (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0);
      const plotH = app.renderer.height - bo;

      state.offsetY = app.renderer.height / 2 - ratio * plotH * state.scaleY;
    }
  };

  // Рисовалка свеч
  const drawCandlesOnly = () => {
    if (!candleLayer || !state.candles.length || !app?.renderer) return;

    if (state._liveOverride && state.candles.length) {
      const last = state.candles.at(-1);
      const p = state._liveOverride.price;
      if (typeof p === 'number' && isFinite(p)) {
        last.close = p;
        if (p > last.high) last.high = p;
        if (p < last.low) last.low = p;
      }
    }
    const settings = state.candleRenderSettings;
    const { width, height } = app.renderer;
    const cw = (config.candleWidth + config.spacing) * state.scaleX;

    // choose series based on style
    const style = state.chartStyle || 'candles';
    const series =
      style === 'heikin' ? toHeikin(state.candles) :
      state.candles;

    const highs = series.map(c => c.high ?? c.close);
    const lows  = series.map(c => c.low ?? c.close);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;

    // rerender key considers style; force rerender on style change
    const key = [style, state.scaleX, state.scaleY, state.offsetX, state.offsetY, series.length, width, height].join('_');
    const force = state._needRedrawCandles || lastStyle !== style;
    if (key === lastKey && !force) return;
    lastKey = key;
    lastStyle = style;

    // compute visible range by X
    const startIdx = Math.max(0, Math.floor((-state.offsetX) / cw) - 2);
    const endIdx = Math.min(series.length, Math.ceil((width - config.rightOffset - state.offsetX) / cw) + 2);

    // expand graphics pool if needed
    while (sprites.length < series.length) {
      const g = new PIXI.Graphics();
      g.zIndex = 10;
      sprites.push(g);
      candleLayer.addChild(g);
    }

    // hide out-of-range and clear when style switches to avoid overlapped shapes
    for (let i = 0; i < sprites.length; i++) {
      sprites[i].visible = i >= startIdx && i < endIdx;
      if (!sprites[i].visible || force) {
        try { sprites[i].clear(); } catch {}
      }
    }

    const plotH = state.layout?.plotH ?? (height - config.bottomOffset);
    const mapY = val => (plotH * (1 - (val - min) / range)) * state.scaleY + state.offsetY;
    //line
    if (style === 'line') {
      try {
        candleLayer.removeChildren();
        destroyGraphicsArray(sprites);
        sprites = [];
      } catch {}
      const gLine = new PIXI.Graphics();
      gLine.zIndex = 10;
      candleLayer.addChild(gLine);

      for (let i = startIdx; i < endIdx; i++) {
        const v = series[i];
        const x = i * cw + state.offsetX;
        const y = mapY(v.close);
        if (i === startIdx) gLine.moveTo(x, y);
        else gLine.lineTo(x, y);
      }
      gLine.stroke({
        width: settings.lineWidth,
        color: settings.lineColor,
        alpha: 1
      });
      state._needRedrawCandles = false;
      return;
    }
    //bars
if (style === 'bars') {
  try {
    candleLayer.removeChildren();
    destroyGraphicsArray(sprites);
    sprites = [];
  } catch {}

  const gBull = new PIXI.Graphics();
  const gBear = new PIXI.Graphics();
  gBull.zIndex = gBear.zIndex = 10;
  candleLayer.addChild(gBull, gBear);

  const tickLen = Math.max(
    2,
    Math.min(12, config.candleWidth * state.scaleX * settings.barTickRatio)
  );

  // бычьи бары (одним stroke)
  for (let i = startIdx; i < endIdx; i++) {
    const v = series[i];
    if (v.close < v.open) continue;
    const x = i * cw + state.offsetX;
    const yOpen  = mapY(v.open);
    const yClose = mapY(v.close);
    const yHigh  = mapY(v.high);
    const yLow   = mapY(v.low);

    gBull.moveTo(x, yHigh).lineTo(x, yLow);
    gBull.moveTo(x - tickLen, yOpen).lineTo(x, yOpen);
    gBull.moveTo(x, yClose).lineTo(x + tickLen, yClose);
  }
  gBull.stroke({ width: settings.barLineWidth, color: +config.candleBull, alpha: 1 });

  // медвежьи бары (одним stroke)
  for (let i = startIdx; i < endIdx; i++) {
    const v = series[i];
    if (v.close >= v.open) continue;
    const x = i * cw + state.offsetX;
    const yOpen  = mapY(v.open);
    const yClose = mapY(v.close);
    const yHigh  = mapY(v.high);
    const yLow   = mapY(v.low);

    gBear.moveTo(x, yHigh).lineTo(x, yLow);
    gBear.moveTo(x - tickLen, yOpen).lineTo(x, yOpen);
    gBear.moveTo(x, yClose).lineTo(x + tickLen, yClose);
  }
  gBear.stroke({ width: settings.barLineWidth, color: +config.candleBear, alpha: 1 });

  state._needRedrawCandles = false;
  return;
}


    // render candles/heikin using pooled Graphics per index
    for (let i = startIdx; i < endIdx; i++) {
      const v = series[i];
      const g = sprites[i];
      const x = i * cw + state.offsetX;
      const color = v.close >= v.open ? +config.candleBull : +config.candleBear;

      const yOpen  = mapY(v.open);
      const yClose = mapY(v.close);
      const yHigh  = mapY(v.high);
      const yLow   = mapY(v.low);

      g.clear().visible = true;

      // wick
      g.moveTo(x + (config.candleWidth * state.scaleX) / 2, yHigh)
       .lineTo(x + (config.candleWidth * state.scaleX) / 2, yLow)
       .stroke({ width: 1, color });

      // body
      g.rect(
        x,
        Math.min(yOpen, yClose),
        config.candleWidth * state.scaleX,
        Math.max(1, Math.abs(yClose - yOpen))
      ).fill(color);
    }

    state._needRedrawCandles = false;
  };

  const createFullLayout = bo => {
    const base = createLayout(
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
      ...base,
      candles: state.candles,
      volumes: state.volumes,
      config,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      scaleX: state.scaleX,
      scaleY: state.scaleY,
      timeframe: state.timeframe,
      plotX: 0,
      plotY: 0,
      plotW: base.width - config.rightOffset,
      plotH: base.height - bo
    };
  };

  const renderAll = () => {
    if (!state.candles.length) return;

    const bo = (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0);
    const layout = createFullLayout(bo);
    state.layout = layout;
    subGroup.y = layout.plotH;

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

    if (modules.candles) drawCandlesOnly();
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
    if (modules.indicators && chartCore.indicators) chartCore.indicators.renderAll(layout);
  };

  const redrawLayoutOnly = () => {
    if (!state.candles.length) return;

    const bo = Math.max(config.bottomOffset, chartCore.indicators?.getBottomStackHeight?.() || 0);
    const layout = createFullLayout(bo);
    state.layout = layout;

    if (modules.candles) drawCandlesOnly();
    if (modules.livePrice && state.livePrice) state.livePrice.render(layout);
    if (modules.indicators && chartCore.indicators) chartCore.indicators.renderAll(layout);
  };

  const draw = async ({ candles, volumes }) => {
    const init = state.candles.length === 0;

    applyAutoCenter(candles, volumes, init);
    state.layout = createFullLayout(
      (config.bottomOffset || 0) + (chartCore.indicators?.getBottomStackHeight?.() || 0)
    );

    // quick render
    if (modules.candles) drawCandlesOnly();

    const fontSpec = `${config.chartFontSize}px ${config.chartFont}`;
    await document.fonts.load(fontSpec);

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

      if (modules.candles) drawCandlesOnly();

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

  const panWrapped = (...a) => {
    state.userHasPanned = true;
    state.isFirstAutoCenter = false;
    return pan(...a);
  };
  const zoomXWrapped = (...a) => {
    state.userHasPanned = true;
    state.isFirstAutoCenter = false;
    return zoomX(...a);
  };
  const zoomYWrapped = (...a) => {
    state.userHasPanned = true;
    state.isFirstAutoCenter = false;
    return zoomY(...a);
  };

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

    // destroy candle graphics & layer
    try { destroyGraphicsArray(sprites); sprites = []; } catch {}
    try { candleLayer?.destroy?.({ children: true }); } catch {}

    // clear texture caches
    clearPixiTextureCaches();

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

    // destroy mask and groups
    try { mask?.destroy?.({ children: true, texture: true, baseTexture: true }); } catch {}
    try { subGroup?.destroy?.({ children: true }); } catch {}
    try { graphGroup?.destroy?.({ children: true }); } catch {}

    if (app?.view?.parentNode) app.view.parentNode.removeChild(app.view);
    try {
      app?.destroy?.(true, { children: true, texture: true, baseTexture: true });
    } catch {}
  };

  const updateLast = candle => {
    updateLastCandle(candle);
    if (Array.isArray(state.volumes))
      state.volumes[state.volumes.length - 1] = candle.volume;

    if (modules.candles) drawCandlesOnly();

    if (modules.livePrice && state.livePrice && state.layout)
      state.livePrice.render(state.layout);
    if (modules.indicators && chartCore.indicators && state.layout)
      chartCore.indicators.renderAll(state.layout);
  };

  const setChartStyle = style => {
    if (!['candles', 'line', 'heikin', 'bars'].includes(style)) return;

    resetCandleCursor();

    candleLayer?.removeChildren();
    destroyGraphicsArray(sprites);
    sprites = [];

    state.chartStyle = style;
    state._needRedrawCandles = true;
    renderAll();
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
    setChartStyle,
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
