//chart.js
import { createChartCore } from "./chart-core.js";

let chartCore = null;

export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");
  if (chartCore?.destroy) { chartCore.destroy(); chartCore = null; }
  chartCore = await createChartCore(container, {
    exchange: opts.exchange,
    marketType: opts.marketType,
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    livePrice: opts.livePrice
  });
  window.chartCore = chartCore;
  // resize
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      chartCore.resize();
    }, 5);
  };
  window.addEventListener("resize", onResize);
  chartCore._onResize = onResize;
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
