//ticker.js
import { startChartRender } from "./chart.js";
import { resetCandleCursor } from "./chart-candles.js";
import { Indicators } from "./indicators/index.js";
import { ChartConfig } from "./chart-config.js";

let timeframe = null;

function changeTimeframe(newTF) {
    timeframe = newTF;
    localStorage.setItem("timeframe", timeframe);
    document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));
    const active = Array.from(document.querySelectorAll(".timeframes i"))
        .find(i => i.getAttribute("rel") === timeframe);
    if (active) active.classList.add("on");
    if (window.chartCore) {
        window.chartCore.destroy();
    }
    startChartRender(timeframe);
    const storedStyle = localStorage.getItem("chartStyle") || "candles";
    if (storedStyle !== "candles") {
        changeChartStyle(storedStyle);
    } else {
        highlightStyle("candles");
    }
    restoreIndicators();
}

function resizeChart() {if (window.chartCore?.resize) { window.chartCore.resize();}}

function highlightStyle(style) {
    document.querySelectorAll(".view .drop a").forEach(a => a.classList.remove("on"));
    const active = document.querySelector(`.view .drop a[rel="${style}"]`);
    if (active) active.classList.add("on");
}

function changeChartStyle(style) {
    if (!window.chartCore) return;
    resetCandleCursor();
    window.chartCore.setChartStyle(style);
    localStorage.setItem("chartStyle", style);
    highlightStyle(style); 
    window.chartCore.drawCandlesOnly?.();
}

// --- сохранение активных индикаторов ---
function saveActiveIndicators() {
    if (!window.chartCore?.indicators) return;
    const active = window.chartCore.indicators.listActive?.() || [];
    localStorage.setItem("activeIndicators", JSON.stringify(active));
}

// --- восстановление активных индикаторов ---
function restoreIndicators() {
    const storedIndicators = JSON.parse(localStorage.getItem("activeIndicators") || "[]");
    if (!Array.isArray(storedIndicators) || !storedIndicators.length) return;

    storedIndicators.forEach(id => {
        if (Indicators[id] && !window.chartCore.indicators.isActive(id)) {
            window.chartCore.indicators.add(id);
            const li = document.querySelector(`.indicator-list li[data-indicator="${id}"]`);
            li?.classList.add("on");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // --- инициализация таймфрейма ---
    const stored = localStorage.getItem("timeframe");
    const fallback = document.getElementById("tf")?.getAttribute("data-default");
    const initialTF = stored || fallback;
    if (!initialTF) {
        console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен");
        return;
    }
    const activeTFEl = Array.from(document.querySelectorAll("#tf i"))
        .find(i => i.getAttribute("rel") === initialTF);
    if (activeTFEl) activeTFEl.classList.add("on");
    changeTimeframe(initialTF);

    // --- стиль графика ---
    const savedStyle = localStorage.getItem("chartStyle") || "candles";
    highlightStyle(savedStyle);
    if (savedStyle !== "candles") {
        changeChartStyle(savedStyle);
    }

    // --- динамическое меню индикаторов ---
    const indicatorList = document.querySelector(".indicator-list");
    if (indicatorList) {
        indicatorList.innerHTML = "";

        const configured = Array.isArray(ChartConfig?.indicators)
            ? ChartConfig.indicators
            : [];

        const allowed = configured.filter(name => Indicators[name]);

        console.log("📊 Разрешённые индикаторы:", allowed);

        allowed.forEach(name => {
            const li = document.createElement("li");
            li.textContent = name.toUpperCase();
            li.setAttribute("data-indicator", name);

            li.addEventListener("click", () => {
                if (!window.chartCore?.indicators) return;

                if (window.chartCore.indicators.isActive(name)) {
                    window.chartCore.indicators.remove(name);
                    li.classList.remove("on");
                } else {
                    window.chartCore.indicators.add(name);
                    li.classList.add("on");
                }
                saveActiveIndicators();
            });

            indicatorList.appendChild(li);
        });
    }

    // восстановление индикаторов при загрузке страницы
    restoreIndicators();
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

document.querySelectorAll(".exchanges li").forEach(item => {
    item.addEventListener("click", () => {
        const exchange = item.getAttribute("data-exchange");
        localStorage.setItem("exchange", exchange);

        // подсветка
        document.querySelectorAll(".exchanges li").forEach(li => li.classList.remove("on"));
        item.classList.add("on");

        // пересоздать график
        if (window.chartCore) {
            window.chartCore.destroy();
        }
        startChartRender(timeframe, exchange);
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
    localStorage.removeItem("activeIndicators"); // ← сброс выбранных индикаторов

    // снять подсветку с таймфреймов
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

    // Перезапуск графика
    startChartRender(tfDefault);

    // Сбросить стиль на candles
    localStorage.setItem("chartStyle", "candles");
    changeChartStyle("candles");

    // Принудительно обновить меню: снять все и подсветить candles
    document.querySelectorAll(".view .drop a").forEach(a => a.classList.remove("on"));
    const defaultItem = document.querySelector(`.view .drop a[rel="candles"]`);
    if (defaultItem) defaultItem.classList.add("on");

    // Очистить список активных индикаторов в DOM
    document.querySelectorAll(".indicator-list li").forEach(li => li.classList.remove("on"));
    const mIndicators = document.querySelector(".m-indicators");
    if (mIndicators) {
        mIndicators.innerHTML = "";
        mIndicators.classList.remove("on");
    }

    console.log("🧯 Storage очищен, график сброшен на", tfDefault);
});
