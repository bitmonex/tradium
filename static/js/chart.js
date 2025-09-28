//chart.js
import { createChartCore } from "./chart-core.js";
import { loadChartData } from "./chart-data.js";
import { initLive } from "./chart-live.js";
import { initRealtimeCandles } from "./chart-candles-init.js";

let chartCore = null;

export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  if (chartCore?.destroy) { chartCore.destroy(); chartCore = null; }

  const { candles, volumes } = await loadChartData(opts.exchange, opts.marketType, opts.symbol, opts.timeframe);
  if (!candles.length) { console.warn("❌ Нет данных для отрисовки"); return; }

  chartCore = await createChartCore(container, {
    exchange: opts.exchange, marketType: opts.marketType, symbol: opts.symbol, livePrice: opts.livePrice
  });
  window.chartCore = chartCore;

  const cwBase = (+chartCore.config.candleWidth || 5) + (+chartCore.config.spacing || 2);
  const minScaleX = +chartCore.config.minScaleX || 0.2;
  const maxScaleX = +chartCore.config.maxScaleX || 8;

  const fitScaleXToWidth = () => {
    const viewW = chartCore.app.renderer.width - (+chartCore.config.rightOffset || 0);
    const target = candles.length * cwBase;
    if (target <= 0 || viewW <= 0) return chartCore.state.scaleX || 1;
    return Math.max(minScaleX, Math.min(maxScaleX, viewW / target));
  };

  const clampOffsetXToRightEdge = () => {
    if (!chartCore.layout) return;
    const viewW = chartCore.app.renderer.width - (+chartCore.config.rightOffset || 0);
    const lastX = chartCore.layout.timeToX(candles.at(-1).time);
    chartCore.state.offsetX = viewW - lastX - (+chartCore.config.candleWidth || 5);
  };

  chartCore.state.scaleX = fitScaleXToWidth();
  clampOffsetXToRightEdge();
  chartCore.draw({ candles, volumes });

  const last = candles.at(-1);
  if (last && !last.isFinal) chartCore.updateLast(last);

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      chartCore.resize();
      clampOffsetXToRightEdge();
      chartCore.drawCandlesOnly?.();
    }, 5);
  };
  window.addEventListener("resize", onResize);
  chartCore._onResize = onResize;

  if (chartCore.config.modules?.livePrice) initLive(chartCore, { ...opts });
  initRealtimeCandles(chartCore, { ...opts, onUpdate: isNewBar => {
    chartCore.drawCandlesOnly?.();
    if (isNewBar) clampOffsetXToRightEdge();
  }});

  return chartCore;
}

export async function startChartRender(tf) {
  const container = document.getElementById("chart-container");
  if (!container) return console.warn("❌ Chart container not found");

  const { exchange, marketType, symbol } = container.dataset;
  if (!exchange || !marketType || !symbol || !tf) return console.warn("⛔ Недостаточно параметров для запуска графика");

  if (window.chartCore?.destroy) {
    try {
      if (window.chartCore._onResize) window.removeEventListener('resize', window.chartCore._onResize);
      window.chartCore.destroy();
    } catch (e) { console.warn("[Chart] destroy error", e); }
    window.chartCore = null;
  }

  await initPixiChart("chart-container", { exchange, marketType, symbol, timeframe: tf, livePrice: true });
}