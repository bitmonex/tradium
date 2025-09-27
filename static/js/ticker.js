//ticker.js
import { startChartRender } from "./chart.js";
import { resetCandleCursor } from "./chart-candles.js";

let timeframe = null;

function changeTimeframe(newTF) {
    timeframe = newTF;
    localStorage.setItem("timeframe", timeframe);
    document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));
    const active = Array.from(document.querySelectorAll(".timeframes i"))
        .find(i => i.getAttribute("rel") === timeframe);
    if (active) active.classList.add("on");
    // перед сменой таймфрейма — снести старый график
    if (window.chartCore) {
        window.chartCore.destroy();
    }
    // запуск с новым TF
    startChartRender(timeframe);
    // восстановить стиль (если не candles)
    const storedStyle = localStorage.getItem("chartStyle") || "candles";
    if (storedStyle !== "candles") {
        changeChartStyle(storedStyle);
    } else {
        highlightStyle("candles");
    }
}

function resizeChart() {if (window.chartCore?.resize) { window.chartCore.resize();}}

function highlightStyle(style) {
    document.querySelectorAll(".view .drop a").forEach(a => a.classList.remove("on"));
    const active = document.querySelector(`.view .drop a[rel="${style}"]`);
    if (active) active.classList.add("on");
}

// переключение моделей свеч
function changeChartStyle(style) {
    if (!window.chartCore) return;
    resetCandleCursor();
    window.chartCore.setChartStyle(style);
    localStorage.setItem("chartStyle", style);
    highlightStyle(style);
    window.chartCore.drawCandlesOnly?.();
}

document.addEventListener("DOMContentLoaded", () => {
    const storedGrid = JSON.parse(localStorage.getItem("gridSettings"));
    window.chartSettings = { grid: storedGrid || { enabled: true, color: "#ffffff" } };
    const stored = localStorage.getItem("timeframe");
    const fallback = document.getElementById("tf")?.getAttribute("data-default");
    const initialTF = stored || fallback;
    if (!initialTF) {
        console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен");
        return;
    }
    const active = Array.from(document.querySelectorAll("#tf i"))
        .find(i => i.getAttribute("rel") === initialTF);
    if (active) active.classList.add("on");
    changeTimeframe(initialTF);
    // восстановить стиль и подсветку
    const savedStyle = localStorage.getItem("chartStyle") || "candles";
    highlightStyle(savedStyle);
    if (savedStyle !== "candles") {
        changeChartStyle(savedStyle);
    }
});

document.querySelectorAll(".timeframes i").forEach(item => {
    item.addEventListener("click", () => {
        changeTimeframe(item.getAttribute("rel"));
    });
});

// Drop-меню: стиль и индикаторы
document.querySelectorAll(".view i, .indicator i").forEach(el => {
    el.addEventListener("click", function (event) {
        event.stopPropagation();
        this.classList.toggle("on");
        this.nextElementSibling.classList.toggle("show");
    });
});
document.addEventListener("click", (event) => {
    document.querySelectorAll(".drop").forEach(menu => {
        if (!menu.closest(".view, .indicator")?.contains(event.target)) {
            menu.classList.remove("show");
            menu.previousElementSibling?.classList.remove("on");
        }
    });
});

// клики по пунктам меню стилей
document.querySelectorAll(".view .drop a").forEach(item => {
    item.addEventListener("click", () => {
        const style = item.getAttribute("rel");
        changeChartStyle(style);
    });
});

// Поиск по индикаторам
const indicatorInput = document.getElementById("indicator-search");
const indicatorList = document.querySelector(".indicator-list");
indicatorInput?.addEventListener("input", () => {
    const keyword = indicatorInput.value.toLowerCase();
    indicatorList.querySelectorAll("li").forEach(li => {
        const match = li.textContent.toLowerCase().includes(keyword);
        li.style.display = match ? "block" : "none";
    });
});

// Сайдбары: Trades & Orderbook
const trades = document.getElementById("trades-open");
const orderbook = document.getElementById("orderbook-open");
const trades_bar = document.querySelector(".sidebar.trades");
const orderbook_bar = document.querySelector(".sidebar.orderbook");
const ticker = document.querySelector(".ticker");

function closeSidebars() {
    trades?.classList.remove("open");
    trades_bar?.classList.remove("show");
    orderbook?.classList.remove("open");
    orderbook_bar?.classList.remove("show");
    ticker?.classList.remove("wire");
    resizeChart();
}

trades?.addEventListener("click", () => {
    const isOpen = trades_bar?.classList.contains("show");
    closeSidebars();
    if (!isOpen) {
        trades.classList.add("open");
        trades_bar.classList.add("show");
        ticker.classList.add("wire");
        resizeChart();
    }
});

orderbook?.addEventListener("click", () => {
    const isOpen = orderbook_bar?.classList.contains("show");
    closeSidebars();
    if (!isOpen) {
        orderbook.classList.add("open");
        orderbook_bar.classList.add("show");
        ticker.classList.add("wire");
        resizeChart();
    }
});

// Очистка Storage
document.getElementById("clearStorage")?.addEventListener("click", () => {
    localStorage.removeItem("timeframe");
    localStorage.removeItem("chartStyle");
    localStorage.removeItem("activeIndicator");
    document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));
    const tfDefault = document.getElementById("tf")?.getAttribute("data-default");
    if (!tfDefault) {
        console.warn("⛔ Не удалось получить таймфрейм из шаблона");
        return;
    }
    const activeTF = Array.from(document.querySelectorAll("#tf i"))
        .find(i => i.getAttribute("rel") === tfDefault);
    if (activeTF) activeTF.classList.add("on");

    if (window.chartCore) {
        window.chartCore.destroy();
    }
    startChartRender(tfDefault);
    changeChartStyle("candles");
    console.log("Storage очищен, график сброшен на", tfDefault);
});

// Полный экран
document.getElementById("full-open")?.addEventListener("click", () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
});
