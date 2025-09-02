// ticker.js

import { initPixiChart } from "./chart.js";

let currentChart = null
let timeframe = null

function changeTimeframe(newTF) {
  timeframe = newTF
  localStorage.setItem("timeframe", timeframe)

  // 1) Уничтожаем старый график
  if (currentChart?.destroy) {
    currentChart.destroy()
    currentChart = null
    window.chartCore = null
  }

  // 2) Очищаем контейнер от старого <canvas>
  const container = document.getElementById("pixi-chart-container")
  if (container) {
    container.innerHTML = ""
  }

  // 3) Обновляем состояния кнопок
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"))

  const activeBtn = Array.from(document.querySelectorAll(".timeframes i"))
    .find(btn => btn.getAttribute("rel") === timeframe)
  if (activeBtn) {
    activeBtn.classList.add("on")
  }

  // 4) Инициализируем новый график и сохраняем ссылку
  currentChart = initPixiChart(
    "pixi-chart-container",
    {
      exchange:   window.chartSettings.exchange,
      marketType: window.chartSettings.marketType,
      symbol:     window.chartSettings.symbol,
      timeframe
    }
  )

  // Делаем экземпляр доступным для resize()
  window.chartCore = currentChart
}


//Обновление размеров графика
function resizeChart() {
  window.chartCore?.resize?.()
}


//Инициализация при загрузке страницы

document.addEventListener("DOMContentLoaded", () => {
  // Загружаем настройки сетки
  const storedGrid = JSON.parse(localStorage.getItem("gridSettings"))
  window.chartSettings.grid = storedGrid || { enabled: true, color: "#ffffff" }

  // Определяем стартовый таймфрейм
  const tfSelector = document.getElementById("tf")
  const storedTF   = localStorage.getItem("timeframe")
  const fallbackTF = tfSelector?.getAttribute("data-default")
  const initialTF  = storedTF || fallbackTF

  if (!initialTF) {
    console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен")
    return
  }

  // Сбрасываем классы на кнопках
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"))

  // Подсвечиваем кнопку initialTF
  const initBtn = Array.from(document.querySelectorAll(".timeframes i"))
    .find(btn => btn.getAttribute("rel") === initialTF)
  if (initBtn) {
    initBtn.classList.add("on")
  }

  // Запускаем первый рендер
  changeTimeframe(initialTF)
})


// Клики по кнопкам таймфрейма
document.querySelectorAll(".timeframes i")
  .forEach(item => {
    item.addEventListener("click", () => {
      changeTimeframe(item.getAttribute("rel"))
    })
  })


// Drop-меню (стиль и индикаторы)
document.querySelectorAll(".view i, .indicator i")
  .forEach(el => {
    el.addEventListener("click", function(event) {
      event.stopPropagation()
      this.classList.toggle("on")
      this.nextElementSibling.classList.toggle("show")
    })
  })

document.addEventListener("click", (event) => {
  document.querySelectorAll(".drop")
    .forEach(menu => {
      if (!menu.closest(".view, .indicator")?.contains(event.target)) {
        menu.classList.remove("show")
        menu.previousElementSibling?.classList.remove("on")
      }
    })
})


// Поиск по списку индикаторов
const indicatorInput = document.getElementById("indicator-search")
const indicatorList  = document.querySelector(".indicator-list")

indicatorInput?.addEventListener("input", () => {
  const keyword = indicatorInput.value.toLowerCase()
  indicatorList.querySelectorAll("li")
    .forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(keyword)
        ? "block"
        : "none"
    })
})


// Сайдбары: Trades & Orderbook
const trades        = document.getElementById("trades-open")
const orderbook     = document.getElementById("orderbook-open")
const trades_bar    = document.querySelector(".sidebar.trades")
const orderbook_bar = document.querySelector(".sidebar.orderbook")
const ticker        = document.querySelector(".ticker")

function closeSidebars() {
  trades?.classList.remove("open")
  trades_bar?.classList.remove("show")
  orderbook?.classList.remove("open")
  orderbook_bar?.classList.remove("show")
  ticker?.classList.remove("wire")
  resizeChart()
}

trades?.addEventListener("click", () => {
  const isOpen = trades_bar?.classList.contains("show")
  closeSidebars()
  if (!isOpen) {
    trades.classList.add("open")
    trades_bar.classList.add("show")
    ticker.classList.add("wire")
    resizeChart()
  }
})

orderbook?.addEventListener("click", () => {
  const isOpen = orderbook_bar?.classList.contains("show")
  closeSidebars()
  if (!isOpen) {
    orderbook.classList.add("open")
    orderbook_bar.classList.add("show")
    ticker.classList.add("wire")
    resizeChart()
  }
})


// Очистка локального хранилища и сброс графика
document.getElementById("clearStorage")?.addEventListener("click", () => {
  localStorage.removeItem("timeframe")
  localStorage.removeItem("chartStyle")
  localStorage.removeItem("activeIndicator")

  // Сбрасываем класс на кнопках
  document.querySelectorAll(".timeframes i")
    .forEach(btn => btn.classList.remove("on", "active"))

  // Определяем дефолтный таймфрейм
  const defaultTF = document.getElementById("tf")?.getAttribute("data-default")
  if (!defaultTF) {
    console.warn("⛔ Не удалось получить таймфрейм из шаблона")
    return
  }

  // Подсвечиваем дефолтную кнопку
  const activeTF = Array.from(document.querySelectorAll(".timeframes i"))
    .find(btn => btn.getAttribute("rel") === defaultTF)
  if (activeTF) {
    activeTF.classList.add("on")
  }

  // Уничтожаем старый график
  if (currentChart?.destroy) {
    currentChart.destroy()
    currentChart = null
    window.chartCore = null
  }

  // Очищаем контейнер
  const container = document.getElementById("pixi-chart-container")
  if (container) {
    container.innerHTML = ""
  }

  // Перезапускаем с дефолтным таймфреймом
  changeTimeframe(defaultTF)
})


// Полноэкранный режим
document.getElementById("full-open")?.addEventListener("click", () => {
  const el = document.documentElement
  if (el.requestFullscreen)            el.requestFullscreen()
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  else if (el.msRequestFullscreen)     el.msRequestFullscreen()
})
