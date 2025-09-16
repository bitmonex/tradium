import { createChartCore } from "./chart-core.js";
import { loadChartData } from "./chart-data.js";
import { initLive } from "./chart-live.js";
import { initRealtimeCandles } from "./chart-core.js";

let chartCore = null;

/**
 * Инициализация графика
 * @param {string} containerId - id DOM-элемента для графика
 * @param {object} opts - { exchange, marketType, symbol, timeframe, livePrice }
 */
export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  // Уничтожаем предыдущий график
  if (chartCore?.destroy) {
    chartCore.destroy();
    chartCore = null;
  }

  const tf = opts.timeframe;

  // Загружаем данные
  const { candles, volumes } = await loadChartData(
    opts.exchange,
    opts.marketType,
    opts.symbol,
    tf
  );

  if (!candles.length) {
    console.warn("❌ Нет данных для отрисовки");
    return;
  }

  // Создаём ядро графика
  chartCore = await createChartCore(container, {
    exchange: opts.exchange,
    marketType: opts.marketType,
    symbol: opts.symbol,
    livePrice: opts.livePrice
  });

  window.chartCore = chartCore;

  // Периодическая перерисовка только свечей
  setInterval(() => {
    if (window.chartCore?.drawCandlesOnly) {
      window.chartCore.drawCandlesOnly();
    }
  }, 100);

  // Первичная отрисовка
  chartCore.draw({ candles, volumes });

  // Обновляем последнюю свечу, если она не закрыта
  const last = candles.at(-1);
  if (last && !last.isFinal) {
    chartCore.updateLast(last);
  }

  // Ресайз при изменении окна
  window.addEventListener("resize", () => chartCore.resize());

  // Запускаем live-модуль, если включён
  if (chartCore.config.modules.livePrice) {
    initLive(chartCore, { ...opts, timeframe: tf });
  }

  // Подписка на обновления свечей
  initRealtimeCandles(chartCore, { ...opts, timeframe: tf });

  return chartCore;
}

/**
 * Централизованный запуск графика
 * @param {string} tf - таймфрейм
 */
export async function startChartRender(tf) {
  const containerId = "chart-container";
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn("❌ Chart container not found");
    return;
  }

  const exchange   = container.dataset.exchange;
  const marketType = container.dataset.marketType;
  const symbol     = container.dataset.symbol;

  if (!exchange || !marketType || !symbol || !tf) {
    console.warn("⛔ Недостаточно параметров для запуска графика");
    return;
  }

  if (window.chartCore?.destroy) {
    try { window.chartCore.destroy(); } catch (e) { console.warn("[Chart] destroy error", e); }
    window.chartCore = null;
  }

  await initPixiChart(containerId, {
    exchange,
    marketType,
    symbol,
    timeframe: tf,
    livePrice: true
  });
}
