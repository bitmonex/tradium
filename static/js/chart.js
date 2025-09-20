//chart.js
import { createChartCore } from "./chart-core.js";
import { loadChartData } from "./chart-data.js";
import { initLive } from "./chart-live.js";
import { initRealtimeCandles } from "./chart-candles-init.js";

let chartCore = null;

export async function initPixiChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Chart container not found");

  if (chartCore?.destroy) {
    chartCore.destroy();
    chartCore = null;
  }

  const tf = opts.timeframe;

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

  chartCore = await createChartCore(container, {
    exchange: opts.exchange,
    marketType: opts.marketType,
    symbol: opts.symbol,
    livePrice: opts.livePrice
  });

  window.chartCore = chartCore;

  const cwBase = (Number(chartCore.config.candleWidth) || 5) + (Number(chartCore.config.spacing) || 2);
  const minScaleX = Number(chartCore.config.minScaleX) || 0.2;
  const maxScaleX = Number(chartCore.config.maxScaleX) || 8;

  function fitScaleXToWidth() {
    const viewW = chartCore.app.renderer.width - (Number(chartCore.config.rightOffset) || 0);
    const target = candles.length * cwBase;
    if (target <= 0 || viewW <= 0) return chartCore.state.scaleX || 1;
    let s = viewW / target;
    return Math.max(minScaleX, Math.min(maxScaleX, s));
  }

  function clampOffsetXToRightEdge() {
    if (!chartCore.layout) return; // защита от undefined
    const viewW = chartCore.app.renderer.width - (Number(chartCore.config.rightOffset) || 0);
    const lastTime = candles.at(-1).time;
    const lastX = chartCore.layout.timeToX(lastTime);
    const candleW = Number(chartCore.config.candleWidth) || 5;
    chartCore.state.offsetX = viewW - lastX - candleW;
  }

  // 1. Первая отрисовка
  chartCore.state.offsetX = 0;
  chartCore.state.scaleX = fitScaleXToWidth();
  chartCore.draw({ candles, volumes });

  // 2. Прижимаем последнюю свечу
  clampOffsetXToRightEdge();
  chartCore.draw({ candles, volumes });

  // 3. Обновляем последнюю свечу, если она не закрыта
    const last = candles.at(-1);
  if (last && !last.isFinal) {
      chartCore.updateLast(last);
  }

  // 4. Ресайз окна/родителя с дебаунсом
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      chartCore.resize();              // Полный ресайз
      clampOffsetXToRightEdge();       // Прижимаем последнюю свечу
      chartCore.drawCandlesOnly?.();   // Перерисовка из кеша
    }, 5);
  };
  window.addEventListener("resize", onResize);
  chartCore._onResize = onResize;


  // 5. Запускаем live-модуль
  if (chartCore.config.modules?.livePrice) {
    initLive(chartCore, { ...opts, timeframe: tf });
  }

  // 6. Подписка на обновления свечей
  initRealtimeCandles(chartCore, { ...opts, timeframe: tf, onUpdate: (isNewBar) => {
    // коллбек при обновлении свечи
    chartCore.drawCandlesOnly?.();
    if (isNewBar) clampOffsetXToRightEdge();
  }});

  return chartCore;
}

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
    try {
      if (window.chartCore._onResize) {
        window.removeEventListener('resize', window.chartCore._onResize);
      }
      window.chartCore.destroy();
    } catch (e) {
      console.warn("[Chart] destroy error", e);
    }
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
