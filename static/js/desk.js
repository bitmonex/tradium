// Drop Меню
document.querySelectorAll(".view i, .indicator i").forEach(el => {
    el.addEventListener("click", function(event) {
        event.stopPropagation();
        this.classList.toggle("on");
        this.nextElementSibling.classList.toggle("show");
    });
});
document.addEventListener("click", (event) => {
    document.querySelectorAll(".drop").forEach(menu => {
        if (!menu.closest(".view, .indicator").contains(event.target)) {
            menu.classList.remove("show");
            menu.previousElementSibling.classList.remove("on");
        }
    });
});
// Очистка кеша
document.getElementById("clearStorage").addEventListener("click", () => {
    localStorage.clear();
    location.reload();
});

// Загрузка настроек
let tickers = localStorage.getItem("tickers") || "OANDA:SPX500USD,EIGHTCAP:NDQ100,NYSE:DOW,VIX,DXY,total,BTCUSDTPERP,ETHUSDTPERP";
let timeframe = localStorage.getItem("timeframe") || "240";
let chartStyle = localStorage.getItem("chartStyle") || "1";
let indicators = JSON.parse(localStorage.getItem("indicators") || "[]");
let columns = Number(localStorage.getItem("columns")) || 3;

document.getElementById("tickers").value = tickers;
document.getElementById("w").innerText = columns;

// Активация таймфрейма
document.querySelectorAll("#timeframes i").forEach(i => i.classList.remove("on"));
let activeTF = document.querySelector(`#timeframes i[rel='${timeframe}']`);
if (activeTF) activeTF.classList.add("on");

// Смена таймфрейма
function changeTimeframe(newTimeframe) {
    if (!newTimeframe || typeof newTimeframe !== "string") return;
    timeframe = newTimeframe;
    localStorage.setItem("timeframe", timeframe);
    document.querySelectorAll("#timeframes i").forEach(i => i.classList.remove("on"));
    let activeTF = document.querySelector(`#timeframes i[rel='${timeframe}']`);
    if (activeTF) activeTF.classList.add("on");
    updateCharts();
}
document.querySelectorAll("#timeframes i").forEach(item => {
    item.addEventListener("click", () => {
        changeTimeframe(item.getAttribute("rel"));
    });
});

// Загрузка свечей
document.querySelectorAll(".view .drop a").forEach(item => item.classList.remove("on"));
let activeStyle = document.querySelector(`.view .drop a[rel='${chartStyle}']`);
if (activeStyle) activeStyle.classList.add("on");

// Обновление свечей
function changeChartStyle(newStyle) {
    if (!newStyle || typeof newStyle !== "string") return;
    chartStyle = newStyle;
    localStorage.setItem("chartStyle", chartStyle);
    document.querySelectorAll(".view .drop a").forEach(item => item.classList.remove("on"));
    let activeStyle = document.querySelector(`.view .drop a[rel='${chartStyle}']`);
    if (activeStyle) activeStyle.classList.add("on");
    updateCharts();
}
document.querySelectorAll(".view .drop a").forEach(item => {
    item.addEventListener("click", () => {
        changeChartStyle(item.getAttribute("rel"));
    });
});

// Загрузка колонок
document.querySelector(".sizer i[rel='-']").addEventListener("click", () => adjustColumns(-1));
document.querySelector(".sizer i[rel='+']").addEventListener("click", () => adjustColumns(1));

function adjustColumns(change) {
    columns += change;
    columns = Math.max(1, Math.min(5, columns));
    localStorage.setItem("columns", columns);
    document.getElementById("w").innerText = columns;
    document.getElementById("charts-container").style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    updateCharts();
}

// Обновление тикеров
document.getElementById("go").addEventListener("click", () => {
    tickers = document.getElementById("tickers").value;
    localStorage.setItem("tickers", tickers);
    updateCharts();
});
document.getElementById("tickers").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("go").click();
    }
});

// Загрузка индикаторов
if (!Array.isArray(indicators)) indicators = [];
document.querySelectorAll(".indicator-checkbox").forEach(checkbox => {
    checkbox.checked = indicators.includes(checkbox.value);
    checkbox.addEventListener("change", updateIndicators);
});

// Обновление индикаторов
function updateIndicators() {
    indicators = Array.from(document.querySelectorAll(".indicator-checkbox:checked"))
        .map(el => el.value)
        .filter(value => typeof value === "string" && value.trim() !== "");
    localStorage.setItem("indicators", JSON.stringify(indicators));
    updateCharts();
}

// Загрузка графиков
let RowHeight = Number(localStorage.getItem("globalRowHeight")) || 300;
function updateCharts() {
    const container = document.getElementById("charts-container");
    container.innerHTML = "";
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    tickers.split(",").map(t => t.trim()).forEach(ticker => {
        const widgetDiv = document.createElement("div");
        widgetDiv.className = "tradingview-widget-container";
        widgetDiv.style.width = "100%";
        widgetDiv.style.height = `${RowHeight}px`;
        widgetDiv.innerHTML = `
            <b>${ticker}</b>
            <button class="resize" data-ticker="${ticker}">↕️</button>
            <div id="${ticker}" class="chart-content"></div>
        `;
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize: false,
            height: RowHeight,
            symbol: ticker,
            interval: timeframe,
            timezone: "Etc/UTC",
            theme: "dark",
            style: chartStyle,
            locale: "en",
            gridColor: "rgba(0, 0, 0, 0.06)",
            hide_legend: true,
            hide_top_toolbar: true,
            allow_symbol_change: false,
            save_image: false,
            hide_volume: true,
            support_host: "https://www.tradingview.com",
            studies: Array.isArray(indicators) ? indicators : []
        });
        widgetDiv.appendChild(script);
        container.appendChild(widgetDiv);
    });
    // Подстройка графиков
    document.querySelectorAll(".tradingview-widget-container").forEach(widget => {
        widget.style.height = `${RowHeight}px`;
    });
    // Изменение высоты
    document.querySelectorAll(".resize").forEach(btn => {
        btn.addEventListener("mousedown", (event) => {
            let widgetContainer = document.querySelector(".tradingview-widget-container");
            let startY = event.clientY;
            let startHeight = widgetContainer.clientHeight;
            let isResizing = true;
            function resize(event) {
                if (!isResizing) return;
                let newHeight = Math.max(100, startHeight + (event.clientY - startY));

                RowHeight = newHeight;
                localStorage.setItem("globalRowHeight", RowHeight);

                requestAnimationFrame(() => {
                    document.querySelectorAll(".tradingview-widget-container").forEach(widget => {
                        widget.style.height = `${RowHeight}px`;
                    });
                });
            }
            function stopResize() {
                isResizing = false;
                document.body.style.cursor = "default";
                window.removeEventListener("mousemove", resize);
                window.removeEventListener("mouseup", stopResize);
            }
            document.body.style.cursor = "ns-resize";
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResize);
            btn.addEventListener("mouseleave", stopResize);
        });
    });
}
document.querySelectorAll(".tradingview-widget-container iframe").forEach(iframe => {
    iframe.style.height = `${RowHeight}px`;
});
updateCharts();