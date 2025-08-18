import { createChartCore } from "./chart-core.js";
import { loadChartData } from "./chart-data.js";

let chartCore = null;

export async function initPixiChart(containerId, { exchange, marketType, symbol, timeframe }) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  if (chartCore?.destroy) {
    try {
      chartCore.destroy();
    } catch (e) {
      console.warn("🧯 Ошибка при chartCore.destroy():", e);
    }
    chartCore = null;
    window.chartCore = null;
  }

  const { candles } = await loadChartData(exchange, marketType, symbol, timeframe);
  if (!candles.length) {
    console.warn("❌ Нет данных для отрисовки");
    return;
  }

  chartCore = createChartCore(container);
  window.chartCore = chartCore;

  window.addEventListener("resize", () => {
    chartCore.resize();
  });

  chartCore.draw(candles);
  chartCore.updateScales();
}
