// chart.js

import { createChartCore } from "./chart-core.js";
import { loadChartData }   from "./chart-data.js";
import { initLive }        from "./chart-live.js";

let chartCore = null;

export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  // 1) Destroy previous instance
  if (chartCore?.destroy) {
    chartCore.destroy();
    chartCore = null;
  }

  // 2) Load candles and volumes
  const { candles, volumes } = await loadChartData(
    opts.exchange,
    opts.marketType,
    opts.symbol,
    opts.timeframe
  );
  if (!candles.length) {
    console.warn("❌ Нет данных для отрисовки");
    return;
  }

  // 3) Create chart core
  chartCore = createChartCore(container, {
    exchange:   opts.exchange,
    marketType: opts.marketType,
    symbol:     opts.symbol
  });

  // Expose for debugging
  window.chartCore = chartCore;

  // 4) Initial render
  chartCore.draw({ candles, volumes });

  // 5) Re-render on window resize
  window.addEventListener("resize", () => {
    chartCore.resize();
  });

  // 6) Запускаем WebSocket-слушалку тикеров и баров
 initLive(chartCore, opts);
    
  // 7) Возвращаем ядро, чтобы можно было цеплять дополнительные плагины
  return chartCore;
}
