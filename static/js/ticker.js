//ticker.js
import { startChartRender } from "./chart.js";
import { resetCandleCursor } from "./chart-candles.js";
import { ChartConfig } from "./chart-config.js";

let timeframe = null;

function changeTimeframe(newTF) {
  if (timeframe === newTF && window.chartCore) {
    return;
  }
  timeframe = newTF;
  localStorage.setItem("timeframe", timeframe);

  document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));
  const active = Array.from(document.querySelectorAll(".timeframes i"))
    .find(i => i.getAttribute("rel") === timeframe);
  active?.classList.add("on");

  if (window.chartCore) {
    window.chartCore.destroy();
  }

  startChartRender(timeframe, { chartId: window.chartCore?.chartId || "chart1" });

  const storedStyle = localStorage.getItem("chartStyle") || "candles";
  highlightStyle(storedStyle);
}

function resizeChart() {
    if (window.chartCore?.resize) window.chartCore.resize();
}

function highlightStyle(style) {
    document.querySelectorAll(".view .drop a").forEach(a => a.classList.remove("on"));
    const active = document.querySelector(`.view .drop a[rel="${style}"]`);
    if (active) active.classList.add("on");
}

function changeChartStyle(style) {
    if (!window.chartCore) return;
    resetCandleCursor();
    window.chartCore.state.chartStyle = style;
    localStorage.setItem("chartStyle", style);
    highlightStyle(style);
    window.chartCore.state.candlesModule?.render();
}

document.addEventListener("DOMContentLoaded", () => {
    // --- таймфрейм ---
    const stored = localStorage.getItem("timeframe");
    const fallback = document.getElementById("tf")?.getAttribute("data-default");
    const initialTF = stored || fallback || "30m";

    if (!initialTF) {
        console.warn("⛔ Не удалось определить таймфрейм — график не будет загружен");
        return;
    }

    const active = Array.from(document.querySelectorAll("#tf i"))
        .find(i => i.getAttribute("rel") === initialTF);
    if (active) active.classList.add("on");

    changeTimeframe(initialTF);

    const savedStyle = localStorage.getItem("chartStyle") || "candles";
    highlightStyle(savedStyle);
    changeChartStyle(savedStyle);

    // --- индикаторы: наполняем белый список ---
    const indicatorList = document.querySelector(".indicator-list");
    if (indicatorList) {
        indicatorList.innerHTML = "";
        const allowed = ChartConfig.indicators || [];
        allowed.forEach(id => {
            const li = document.createElement("li");
            li.textContent = id.toUpperCase();
            li.dataset.id = id;

            li.addEventListener("click", () => {
                if (!window.chartCore?.indicators) return;

                if (window.chartCore.indicators.isActive(id)) {
                    window.chartCore.indicators.remove(id);
                } else {
                    window.chartCore.indicators.add(id);
                }

                // сохраняем активные индикаторы
                const active = Array.from(window.chartCore.indicators.activeKeys?.() ?? []);
            });

            indicatorList.appendChild(li);
        });
    }
});


document.querySelectorAll(".timeframes i").forEach(item => {
    item.addEventListener("click", () => {
        changeTimeframe(item.getAttribute("rel"));
    });
});

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

document.querySelectorAll(".view .drop a").forEach(item => {
    item.addEventListener("click", () => {
        const style = item.getAttribute("rel");
        changeChartStyle(style);
    });
});

const indicatorInput = document.getElementById("indicator-search");
const indicatorList = document.querySelector(".indicator-list");
indicatorInput?.addEventListener("input", () => {
    const keyword = indicatorInput.value.toLowerCase();
    indicatorList.querySelectorAll("li").forEach(li => {
        const match = li.textContent.toLowerCase().includes(keyword);
        li.style.display = match ? "block" : "none";
    });
});

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

document.getElementById("clearStorage")?.addEventListener("click", () => {
    localStorage.removeItem("timeframe");
    localStorage.removeItem("chartStyle");

    // сброс индикаторов через менеджер
    if (window.chartCore?.indicators) {
        window.chartCore.indicators.reset();
    }
    Object.keys(localStorage)
      .filter(k => k.startsWith('indicators_'))
      .forEach(k => localStorage.removeItem(k));
  
    document.querySelectorAll(".timeframes i").forEach(i => i.classList.remove("on"));

    const tfDefault = document.getElementById("tf")?.getAttribute("data-default") || "30m";
    if (!tfDefault) {
        console.warn("⛔ Не удалось получить таймфрейм из шаблона");
        return;
    }

    const activeTF = Array.from(document.querySelectorAll("#tf i"))
        .find(i => i.getAttribute("rel") === tfDefault);
    if (activeTF) activeTF.classList.add("on");

    const chartId = window.chartCore?.chartId || "chart1";

    if (window.chartCore) {
        window.chartCore.destroy();
    }

    startChartRender(tfDefault, { chartId });
    localStorage.setItem("chartStyle", "candles");
    changeChartStyle("candles");

    document.querySelectorAll(".view .drop a").forEach(a => a.classList.remove("on"));
    const defaultItem = document.querySelector(`.view .drop a[rel="candles"]`);
    if (defaultItem) defaultItem.classList.add("on");

    console.log("🧯 Storage очищен, график сброшен на таймфрейм:", tfDefault);
});

const fullBtn = document.getElementById("full-open");
const fullIcon = fullBtn?.querySelector("b");

function toggleFullscreen() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    if (isFullscreen) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        fullIcon?.classList.remove("icon-full-2");
        fullIcon?.classList.add("icon-full");
    } else {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
        fullIcon?.classList.remove("icon-full");
        fullIcon?.classList.add("icon-full-2");
    }
}

fullBtn?.addEventListener("click", toggleFullscreen);
