// chart-core.js
import { ChartConfig } from './chart-config.js';
import { initModules } from './chart-modules.js';
import { createLayout, autoCenterCandles } from './chart-layout.js';

export async function createChartCore(container, userConfig = {}) {
  const chartId = userConfig.chartId || container.id || "chart1";
  const fullConfig = { ...ChartConfig, ...userConfig };
  const { default: defStyles, modules, exchange, marketType, symbol, timeframe, ...sections } = fullConfig;

  const config = {
    ...defStyles,
    candles: sections.candles,
    grid: sections.grid,
    ohlcv: sections.ohlcv,
    fps: sections.fps,
    scales: sections.scales,
    indicators: sections.indicators,
    livePrice: sections.livePrice,
    modules
  };

  const chartSettings = { exchange, marketType, symbol, timeframe };

  // PIXI приложение
  const app = new PIXI.Application();
  await app.init({
    resizeTo: container,
    background: config.chartBG,
    antialias: true,
    autoDensity: true
  });
  app.stage.sortableChildren = true;
  container.appendChild(app.view);

  // --- группы ---
  const graphGroup = new PIXI.Container();
  graphGroup.sortableChildren = true;
  app.stage.addChild(graphGroup);

  const subGroup = new PIXI.Container();
  subGroup.sortableChildren = true;
  app.stage.addChild(subGroup);

  const subBg = new PIXI.Graphics();
  subBg.zIndex = -1;
  subGroup.addChild(subBg);
  
  const viewportMask = new PIXI.Graphics();
  graphGroup.mask = viewportMask;
  app.stage.addChild(viewportMask);

  const candleLayer = new PIXI.Container();
  candleLayer.zIndex = 5;
  graphGroup.addChild(candleLayer);

  const state = {
    layout: null,
    fps: null,
    graphGroup,
    subGroup,
    subBg,
    modules,
    candles: [],
    chartStyle: "candles",
    candleLayer,
    tfMs: 60000,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    _needRedrawCandles: false,
    _centered: false
  };

  // --- Планировщик ---
  let rafScheduled = false, wantFull = false;
  const scheduleRender = ({ full = false } = {}) => {
    wantFull ||= full;
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      Render({ full: wantFull });
      wantFull = false;
    });
  };

  function renderDebugViewport(state, layer) {
    if (!state.layout) return;
    let g = layer._debugG;
    if (!g || g.destroyed) {
      g = new PIXI.Graphics();
      g.zIndex = 1;
      layer.addChild(g);
      layer._debugG = g;
      layer.sortableChildren = true;
    }
    g.clear();
    const { width, height, rightOffset, bottomOffset } = state.layout;
    const w = width - rightOffset;
    const h = height - bottomOffset;
    g.beginFill(0x0F0E0E, 1);
    g.drawRect(0, 0, w, h);
    g.endFill();
  }

  // chartCore объект
  const chartCore = {};

  // --- Render ---
  const Render = ({ full = false } = {}) => {
    if (full) {
      const bottomHeight = chartCore.indicators?.getBottomStackHeight() || 0;
      state.layout = createLayout(
        app,
        config,
        state.candles,
        state.offsetX,
        state.offsetY,
        state.scaleX,
        state.scaleY,
        state.tfMs,
        bottomHeight
      );
      if (!state.layout) return; // 🔹 защита
      state.layout.candles = state.candles;

      if (state.candles.length && !state._centered) {
        autoCenterCandles({ state });
        state._centered = true;
        state.layout = createLayout(
          app,
          config,
          state.candles,
          state.offsetX,
          state.offsetY,
          state.scaleX,
          state.scaleY,
          state.tfMs,
          bottomHeight
        );
        if (!state.layout) return; // 🔹 защита
        state.layout.candles = state.candles;
      }

      state.subGroup.y = state.layout.plotY + state.layout.plotH;
      viewportMask
        .clear()
        .beginFill(0x000000)
        .drawRect(
          state.layout.plotX,
          state.layout.plotY,
          state.layout.plotW,
          state.layout.plotH
        )
        .endFill();

      state.candlesModule?.render();
      chartCore.indicators?.renderAll(state.layout);
      renderDebugViewport(state, graphGroup);

    } else if (state._needRedrawCandles) {
      state.candlesModule?.render();
      state._needRedrawCandles = false;
      if (state.layout) chartCore.indicators?.renderAll(state.layout);
    }
  };

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    app.renderer.resize(width, height);
    app.view.style.width = width + 'px';
    app.view.style.height = height + 'px';
    scheduleRender({ full: true });
  };

  const destroy = () => {
    if (!chartCore._alive) return;
    chartCore._alive = false;
    try { state.fps?.destroy?.(); } catch {}
    try { graphGroup?.destroy?.({ children: true }); } catch {}
    if (app?.view?.parentNode) app.view.parentNode.removeChild(app.view);
    try { app?.destroy?.(true, { children: true, texture: true, baseTexture: true }); } catch {}
    chartCore.state = null;
  };

  // наполняем chartCore
  Object.assign(chartCore, {
    chartId,
    resize,
    app,
    config,
    state,
    graphGroup,
    scheduleRender,
    destroy,
    _alive: true,
    chartSettings
  });

  // Подключаем модули
  initModules({ app, config, chartSettings, graphGroup, state, modules, chartCore });

  // Первый полный рендер
  scheduleRender({ full: true });

  return chartCore;
}
