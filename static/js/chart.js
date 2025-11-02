//chart.js
import { createChartCore } from "./chart-core.js";
import { loadMoreCandles } from "./chart-data.js";

let chartCore = null;
let isLoading = false;
let noMoreData = false;
let loadTimer = null;

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
      console.log("[resize] событие ресайза окна");
      chartCore.resize();
      loadHistoryChunk("resize");
      hideLoader(); // 👉 убираем лоадер при ресайзе
    }, 200);
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

  // 👉 СБРОС ФЛАГОВ при смене ТФ/символа
  noMoreData = false;
  isLoading = false;
  if (window.chartCore?.state) {
    window.chartCore.state.noMoreData = false;
  }
  hideLoader();

  if (window.chartCore?.destroy) {
    try {
      if (window.chartCore._onResize) window.removeEventListener('resize', window.chartCore._onResize);
      window.chartCore.destroy();
    } catch (e) { console.warn("[Chart] destroy error", e); }
    window.chartCore = null;
  }

  await initPixiChart("chart-container", { exchange, marketType, symbol, timeframe: tf, livePrice: true });
}

export async function loadHistoryChunk(trigger = "manual") {
  const core = window.chartCore;
  if (!core) return;

  clearTimeout(loadTimer);
  loadTimer = setTimeout(async () => {
    if (isLoading) {
      console.log(`[${trigger}] ❌ Пропуск: уже идёт загрузка`);
      return;
    }
    if (noMoreData) {
      console.log(`[${trigger}] ⚠️ Пропуск: данных больше нет`);
      showLoader("The End");
      return;
    }

    const { exchange, marketType, symbol, timeframe } = core.config;
    const candles = core.state.candles;
    if (!candles.length) return;

    console.log(`[${trigger}] 🔎 candles[0]=${new Date(candles[0].time).toISOString()}, candles[last]=${new Date(candles[candles.length - 1].time).toISOString()}`);

    let oldestMs = candles[0].time < candles[candles.length - 1].time
      ? candles[0].time
      : candles[candles.length - 1].time;

    const oldest = Math.floor(oldestMs / 1000);
    const oldestDate = new Date(oldestMs).toISOString();

    console.log(
      `[${trigger}] 🚀 Начало загрузки. Текущих свечей: ${candles.length}, `
      + `старейшая (s): ${oldest}, дата: ${oldestDate}`
    );

    isLoading = true;
    showLoader("Loading...");

    try {
      const more = await loadMoreCandles(exchange, marketType, symbol, timeframe, oldest);

      if (more.length) {
        core.state.candles.unshift(...more);
        console.log(`[${trigger}] ✅ Догружено ${more.length}, всего теперь: ${core.state.candles.length}`);
        core.scheduleRender({ full: true });
        hideLoader();
      } else {
        console.log(`[${trigger}] ⚠️ Больше данных нет`);
        noMoreData = true;
        core.state.noMoreData = true; 
        showLoader("The End");
      }
    } catch (err) {
      console.error(`[${trigger}] ❌ Ошибка загрузки:`, err);
    } finally {
      isLoading = false;
      console.log(`[${trigger}] 🔚 Завершено, isLoading=${isLoading}`);
    }
  }, 300);
}

// --- UI для лоадера / конца ---
function showLoader(text) {
  let loader = document.getElementById("chart-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "chart-loader";
    loader.style.position = "absolute";
    loader.style.top = "10px";
    loader.style.left = "50%";
    loader.style.transform = "translateX(-50%)";
    loader.style.padding = "4px 8px";
    loader.style.background = "rgba(0,0,0,0.6)";
    loader.style.color = "#fff";
    loader.style.fontSize = "12px";
    loader.style.borderRadius = "4px";
    document.body.appendChild(loader);
  }
  loader.textContent = text;
  loader.style.display = "block";
}

function hideLoader() {
  const loader = document.getElementById("chart-loader");
  if (loader) loader.style.display = "none";
}