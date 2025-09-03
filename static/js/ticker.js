// static/js/ticker.js

import { initPixiChart } from "./chart.js";

let currentChart = null;
let timeframe     = null;

/**
 * Полная перезагрузка графика для нового таймфрейма
 * @param {string} newTF  – например "1m", "1h" и т.п.
 */
async function changeTimeframe(newTF) {
  timeframe = newTF;
  localStorage.setItem("timeframe", timeframe);

  // 1) Уничтожаем старый график
  if (currentChart?.destroy) {
    currentChart.destroy();
    currentChart = null;
    window.chartCore = null;
  }

  // 2) Очищаем контейнер от старого <canvas>
  const container = document.getElementById("pixi-chart-container");
  if (container) container.innerHTML = "";

  // 3) Снимаем подсветку со всех кнопок
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"));

  // Подсвечиваем выбранную
  const activeBtn = Array.from(document.querySelectorAll(".timeframes i"))
    .find(btn => btn.getAttribute("rel") === timeframe);
  if (activeBtn) {
    activeBtn.classList.add("on");
  }

  // 4) Инициализируем новый график и сохраняем объект
  currentChart = await initPixiChart(
    "pixi-chart-container",
    {
      exchange:   window.chartSettings.exchange,
      marketType: window.chartSettings.marketType,
      symbol:     window.chartSettings.symbol,
      timeframe
    }
  );
  window.chartCore = currentChart;
}

// Обновление размеров графика при ресайзе окна
function resizeChart() {
  window.chartCore?.resize?.();
}


// === Инициализация при загрузке страницы ===
document.addEventListener("DOMContentLoaded", () => {
  // 1) Загружаем настройки сетки
  const storedGrid = JSON.parse(localStorage.getItem("gridSettings"));
  window.chartSettings.grid = storedGrid || { enabled: true, color: "#ffffff" };

  // 2) Определяем стартовый таймфрейм
  const tfSelector = document.getElementById("tf");
  const storedTF   = localStorage.getItem("timeframe");
  const fallbackTF = tfSelector?.getAttribute("data-default");
  const initialTF  = storedTF || fallbackTF;

  if (!initialTF) {
    console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен");
    return;
  }

  // 3) Снимаем и ставим класс на кнопках
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"));
  const initBtn = Array.from(document.querySelectorAll(".timeframes i"))
    .find(btn => btn.getAttribute("rel") === initialTF);
  if (initBtn) initBtn.classList.add("on");

  // 4) Запускаем первый рендер
  changeTimeframe(initialTF);
});


// === Клики по кнопкам таймфрейма ===
document.querySelectorAll(".timeframes i").forEach(item => {
  item.addEventListener("click", () => {
    const tf = item.getAttribute("rel");
    if (tf && tf !== timeframe) {
      changeTimeframe(tf);
    }
  });
});


// === Drop-меню (стиль и индикаторы) ===
document.querySelectorAll(".view i, .indicator i")
  .forEach(el => {
    el.addEventListener("click", function(event) {
      event.stopPropagation();
      this.classList.toggle("on");
      this.nextElementSibling.classList.toggle("show");
    });
  });

document.addEventListener("click", () => {
  document.querySelectorAll(".drop")
    .forEach(menu => {
      if (!menu.closest(".view, .indicator")?.contains(event.target)) {
        menu.classList.remove("show");
        menu.previousElementSibling?.classList.remove("on");
      }
    });
});


// === Поиск по списку индикаторов ===
const indicatorInput = document.getElementById("indicator-search");
const indicatorList  = document.querySelector(".indicator-list");

indicatorInput?.addEventListener("input", () => {
  const keyword = indicatorInput.value.toLowerCase();
  indicatorList.querySelectorAll("li")
    .forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(keyword)
        ? "block"
        : "none";
    });
});


// === Сайдбары: Торги и Ордербук ===
const trades        = document.getElementById("trades-open");
const orderbook     = document.getElementById("orderbook-open");
const tradesBar     = document.querySelector(".sidebar.trades");
const orderbookBar  = document.querySelector(".sidebar.orderbook");
const tickerEl      = document.querySelector(".ticker");

function closeSidebars() {
  trades?.classList.remove("open");
  tradesBar?.classList.remove("show");
  orderbook?.classList.remove("open");
  orderbookBar?.classList.remove("show");
  tickerEl?.classList.remove("wire");
  resizeChart();
}

trades?.addEventListener("click", () => {
  const wasOpen = tradesBar?.classList.contains("show");
  closeSidebars();
  if (!wasOpen) {
    trades.classList.add("open");
    tradesBar.classList.add("show");
    tickerEl.classList.add("wire");
    resizeChart();
  }
});

orderbook?.addEventListener("click", () => {
  const wasOpen = orderbookBar?.classList.contains("show");
  closeSidebars();
  if (!wasOpen) {
    orderbook.classList.add("open");
    orderbookBar.classList.add("show");
    tickerEl.classList.add("wire");
    resizeChart();
  }
});


// === Очистка localStorage и сброс графика ===
document.getElementById("clearStorage")?.addEventListener("click", () => {
  localStorage.removeItem("timeframe");
  localStorage.removeItem("chartStyle");
  localStorage.removeItem("activeIndicator");

  // Сбрасываем классы на таймфреймах
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"));

  // Определяем дефолтный TF
  const defaultTF = document.getElementById("tf")?.getAttribute("data-default");
  if (!defaultTF) {
    console.warn("⛔ Не удалось получить таймфрейм из шаблона");
    return;
  }
  // Подсвечиваем дефолт
  document.querySelectorAll(".timeframes i")
    .forEach(btn => {
      if (btn.getAttribute("rel") === defaultTF) {
        btn.classList.add("on");
      }
    });

  // Уничтожаем и очищаем
  if (currentChart?.destroy) {
    currentChart.destroy();
    currentChart = null;
    window.chartCore = null;
  }
  const container = document.getElementById("pixi-chart-container");
  if (container) container.innerHTML = "";

  // Перезапускаем график
  changeTimeframe(defaultTF);
});


// === Полноэкранный режим ===
document.getElementById("full-open")?.addEventListener("click", () => {
  const el = document.documentElement;
  if (el.requestFullscreen)            el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen)     el.msRequestFullscreen();
});


// Обработчик ресайза окна
window.addEventListener("resize", resizeChart);
