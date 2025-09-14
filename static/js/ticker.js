import { initPixiChart } from "./chart.js";

// Таймфрейм будет получен из storage или DOM после загрузки
let timeframe = null;

function changeTimeframe(newTF) {
    timeframe = newTF;
    localStorage.setItem("timeframe", timeframe);

    // 🔹 Уничтожаем старое ядро и live‑подписки, если есть
    if (window.chartCore?.destroy) {
        try {
            window.chartCore.destroy();
        } catch(e) {
            console.warn('[Ticker] destroy error', e);
        }
        window.chartCore = null;
    }

    document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));
    const active = document.querySelector(`.timeframes i[rel='${timeframe}']`);
    if (active) active.classList.add("on");

    const { exchange, marketType, symbol } = window.chartSettings;
    initPixiChart("pixi-chart-container", { exchange, marketType, symbol, timeframe });
}

// Пересчитать родитель при изменении верстки
function resizeChart() {
    if (window.chartCore?.resize) {
        window.chartCore.resize();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const storedGrid = JSON.parse(localStorage.getItem("gridSettings"));
    window.chartSettings.grid = storedGrid || {
        enabled: true,
        color: "#ffffff"
    };

    const tfSelector = document.getElementById("tf");
    const stored = localStorage.getItem("timeframe");
    const fallback = tfSelector?.getAttribute("data-default");

    const initialTF = stored || fallback;

    if (!initialTF) {
        console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен");
        return;
    }

    const active = document.querySelector(`#tf i[rel='${initialTF}']`);
    if (active) active.classList.add("on");

    changeTimeframe(initialTF);
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

    const activeTF = document.querySelector(`#tf i[rel='${tfDefault}']`);
    if (activeTF) activeTF.classList.add("on");

    if (window.chartCore?.destroy) {
        window.chartCore.destroy();
        window.chartCore = null;
    }

    const { exchange, marketType, symbol } = window.chartSettings;
    initPixiChart("pixi-chart-container", { exchange, marketType, symbol, timeframe: tfDefault });

    console.log("🧯 Storage очищен, график сброшен на", tfDefault);
});

// Полный экран
document.getElementById("full-open")?.addEventListener("click", () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
});
