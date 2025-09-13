import { createChartCore } from "./chart-core.js";
import { loadChartData }   from "./chart-data.js";
import { initLive }        from "./chart-live.js";
import { initRealtimeCandles } from "./chart-core.js";

let chartCore = null;

export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  // 1) Destroy previous instance
  if (chartCore?.destroy) {
    chartCore.destroy();
    chartCore = null;
  }

  // 2) Load candles и volumes
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

  // 3) Create chart core + прокидываем флаг livePrice
  //    если opts.livePrice === false — модуль LivePrice не инициализируется
  chartCore = createChartCore(container, {
    exchange:   opts.exchange,
    marketType: opts.marketType,
    symbol:     opts.symbol,
    livePrice:  opts.livePrice
  });

  // expose for debugging
    window.chartCore = chartCore;

    setInterval(() => {
      if (window.chartCore?.drawCandlesOnly) {
        window.chartCore.drawCandlesOnly();
      }
    }, 100);

  // 4) Initial render
  chartCore.draw({ candles, volumes });

  // Если последняя свеча не закрыта — используем её как живую
  const last = candles.at(-1);
  if (last && !last.isFinal) {
    chartCore.updateLast(last);
  }

  // 5) Re-render on window resize
  window.addEventListener("resize", () => chartCore.resize());

  // 6) Запускаем WebSocket-слушалку только если модуль включён в config
  if (chartCore.config.modules.livePrice) {
    initLive(chartCore, opts);
  }
  // Обновление последней свечи
  initRealtimeCandles(chartCore, opts);

  // 7) Возвращаем ядро для плагинов
  return chartCore;
}