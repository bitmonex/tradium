// chart-candles.js
import { num } from './chart-utils.js';

// --- настройки рендера свечей ---
export const candleRenderSettings = {
  candleWidth: 6,
  candleGap: 2,
};

let isLoadingHistory = false;
let noMoreHistory = false;
let historyLoadTimer = null;
let loaderHideTimer = null;

// --- UI лоадера ---
function ensureLoader(chartCore) {
  const parent = chartCore?.app?.view?.parentNode;
  if (!parent) return null;
  let loader = parent.querySelector('.loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'loader';
    parent.appendChild(loader);
  }
  return loader;
}
function showLoader(chartCore, text) {
  if (!chartCore?._alive) return;
  const loader = ensureLoader(chartCore);
  if (loader) {
    loader.textContent = text;
    loader.style.display = 'flex';
    positionLoader(chartCore);
  }
}
function hideLoader(chartCore) {
  if (!chartCore?._alive) return;
  const view = chartCore?.app?.view;
  if (!view || !view.parentNode) return;
  const loader = view.parentNode.querySelector('.loader');
  if (loader) loader.style.display = 'none';
}

// --- позиционирование лоадера ---
export function positionLoader(chartCore) {
  if (!chartCore?._alive) return;
  const loader = chartCore?.app?.view?.parentNode?.querySelector('.loader');
  const L = chartCore?.state?.layout;
  if (!loader || !L) return;
  const { plotX, plotY, plotH } = L;
  loader.style.left = plotX + 'px';
  loader.style.top  = (plotY + plotH) + 'px';
}

// --- утилита: индекс первой видимой свечи ---
export function getLeftVisibleIndex(layout) {
  if (!layout) return 0;
  const denom = layout.spacing * layout.scaleX;
  if (!Number.isFinite(denom) || denom === 0) return 0;
  const i = Math.floor((layout.plotX - layout.offsetX) / denom);
  return Number.isFinite(i) ? Math.max(0, i) : 0;
}

// --- утилита: "касаемся" ли левого края данных? ---
function touchingLeftEdge(chartCore, tolerance = 1) {
  const { layout, candles } = chartCore.state || {};
  if (!layout || !candles?.length) return false;
  const leftIndex = getLeftVisibleIndex(layout);
  // если индекс первой видимой свечи <= (0 + допуск), считаем, что левый край окна упёрся в начало данных
  return leftIndex <= tolerance;
}

// --- утилита: индекс последней видимой свечи ---
export function getRightVisibleIndex(layout, seriesLength) {
  if (!layout || !Number.isFinite(seriesLength) || seriesLength <= 0) return 0;
  const denom = layout.spacing * layout.scaleX;
  if (!Number.isFinite(denom) || denom === 0) return seriesLength - 1;
  const i = Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / denom) - 1;
  return Number.isFinite(i) ? Math.max(0, Math.min(seriesLength - 1, i)) : seriesLength - 1;
}

// --- утилита: "касаемся" ли правого края данных? ---
function touchingRightEdge(chartCore, tolerance = 1) {
  const { layout, candles } = chartCore.state || {};
  if (!layout || !candles?.length) return false;
  const rightIndex = getRightVisibleIndex(layout, candles.length);
  const lastIndex = candles.length - 1;
  return rightIndex >= (lastIndex - tolerance);
}

// --- контроллер баннера конца истории ---
function updateEndBanner(chartCore) {
  if (!chartCore?._alive) return;
  const shouldShow = !!chartCore.state?.noMoreData && touchingLeftEdge(chartCore, 1);
  if (shouldShow) {
    showLoader(chartCore, "The End");
  } else {
    hideLoader(chartCore);
  }
}

// --- инициализация свечей ---
export function initCandles(chartCore, chartSettings) {
  isLoadingHistory = false;
  noMoreHistory = false;
  chartCore._alive = true;
  hideLoader(chartCore);
  chartCore.state.candleRenderSettings = candleRenderSettings;
  // восстановим стиль
  const savedStyle = (localStorage.getItem("chartStyle") 
                  || chartCore.state.chartStyle 
                  || "candles").toLowerCase();
  chartCore.state.chartStyle = savedStyle;
  localStorage.setItem("chartStyle", savedStyle);
  try { chartCore._candleSocket?.close(); } catch {}
  // сначала история
  loadOHLCV(chartCore, chartSettings).then(() => {
    connectCandlesSocket(chartCore, chartSettings);
  });
  return {
    render: () => drawCandlesOnly(chartCore),
    destroy: () => {
      try { chartCore._candleSocket?.close(); } catch {}
      cleanupCandles(chartCore);
      isLoadingHistory = false;
      noMoreHistory = false;
      clearTimeout(historyLoadTimer);
    }
  };
}

// --- загрузка истории ---
async function loadOHLCV(chartCore, { exchange, marketType, symbol, timeframe }) {
  try {
    const url = `/${exchange}/${marketType}/${symbol}/history?tf=${timeframe}&limit=2000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const intervalMs = chartCore.state.tfMs || 60000;
    const candles = data.map(c => {
      let ts = c.time ?? c.timestamp ?? c.openTime;
      if (!ts) return null;
      if (ts < 1e12) ts *= 1000;
      ts = Math.floor(ts / intervalMs) * intervalMs;
      return {
        open:   +c.open,
        high:   +c.high,
        low:    +c.low,
        close:  +c.close,
        volume: +c.volume,
        time: ts,
        timestamp: ts
      };
    }).filter(Boolean);
    chartCore.state.candles = candles;
    chartCore.state.volumes = candles.map(c => c.volume);
    chartCore.state._centered = false;
    chartCore.scheduleRender({ full: true });
    positionLoader(chartCore);
  } catch (err) {
    console.error("[candles] loadOHLCV error:", err);
  }
}

// --- проверка и подгрузка истории (привязка к левому краю) ---
async function checkAndLoadHistory(chartCore, trigger = "viewport") {
  // если уже грузим или сервер сказал "больше нет" — не дергаем сеть
  if (isLoadingHistory || noMoreHistory || chartCore.state.noMoreData) return;

  const { candles, layout } = chartCore.state;
  if (!candles?.length || !layout) return;

  // грузим историю только если окно реально упёрто в левый край данных
  if (!touchingLeftEdge(chartCore, 1)) return;

  clearTimeout(historyLoadTimer);
  historyLoadTimer = setTimeout(async () => {
    isLoadingHistory = true;

    // если конец истории НЕ зафиксирован — показываем процесс
    if (!chartCore.state.noMoreData) {
      showLoader(chartCore, "Loading...");
    } else {
      // если конец истории был зафиксирован ранее, не мешаемся "Loading..." — оставим решение updateEndBanner
      updateEndBanner(chartCore);
    }

    try {
      const oldest = candles[0].time;
      const url = `/${chartCore.chartSettings.exchange}/${chartCore.chartSettings.marketType}/${chartCore.chartSettings.symbol}/history?tf=${chartCore.chartSettings.timeframe}&before=${Math.floor(oldest/1000)}&limit=1000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const intervalMs = chartCore.state.tfMs || 60000;

      // если сервер вернул пусто — фиксируем конец
      if (!Array.isArray(data) || data.length === 0) {
        noMoreHistory = true;
        chartCore.state.noMoreData = true;
        // решаем показ строго через контроллер баннера
        updateEndBanner(chartCore);
        return;
      }

      // нормализация и фильтр свежих слева
      const more = data.map(c => {
        let ts = c.time ?? c.timestamp ?? c.openTime;
        if (!ts) return null;
        if (ts < 1e12) ts *= 1000;
        ts = Math.floor(ts / intervalMs) * intervalMs;
        return {
          open:   +c.open,
          high:   +c.high,
          low:    +c.low,
          close:  +c.close,
          volume: +c.volume,
          time: ts,
          timestamp: ts
        };
      }).filter(Boolean);

      if (more.length > 0) {
        more.sort((a, b) => a.time - b.time);

        const firstTime = candles[0].time;
        const fresh = more.filter(c => c.time < firstTime);

        if (fresh.length > 0) {
          // добавляем слева
          chartCore.state.candles.unshift(...fresh);
          chartCore.state.volumes.unshift(...fresh.map(c => c.volume));

          // кламп offsetX
          const L = chartCore.state.layout;
          if (L) {
            const minX = L.indexToX(0) - L.plotW;
            const maxX = L.indexToX(chartCore.state.candles.length - 1) + L.plotW;
            chartCore.state.offsetX = Math.min(maxX, Math.max(minX, chartCore.state.offsetX));
          }

          console.log("Load Candles:", chartCore.state.candles.length);
          // компенсируем сдвиг так, чтобы картинка "не прыгала"
          const added = fresh.length;
          chartCore.state.offsetX -= added * (chartCore.state.layout.spacing * chartCore.state.scaleX);

          requestAnimationFrame(() => {
            chartCore.scheduleRender({ full: true });
            positionLoader(chartCore);
          });

          // любой приход новых данных снимает визуальный баннер конца (факт края мог устареть)
          chartCore.state.noMoreData = false;

          // финальное решение по баннеру принимает контроллер
          clearTimeout(loaderHideTimer);
          loaderHideTimer = setTimeout(() => {
            updateEndBanner(chartCore);
          }, 3000);
        } else {
          // пришли только дубли — ничего не добавляем
          // просто обновим баннер на основании текущего положения и флага
          clearTimeout(loaderHideTimer);
          loaderHideTimer = setTimeout(() => {
            updateEndBanner(chartCore);
          }, 3000);
        }
      } else {
        // хотя массив не пустой, после нормализации мог опустеть — трактуем как отсутствие новых данных
        updateEndBanner(chartCore);
      }
    } catch (err) {
      console.error(`[${trigger}] load history error:`, err);
      // при ошибке — не навязываем "The End", просто уберём лоадер
      hideLoader(chartCore);
    } finally {
      isLoadingHistory = false;
    }
  }, 200);
}

// --- безопасный вызов подгрузки истории (throttle) ---
let lastHistoryCheck = 0;
export function safeCheckAndLoadHistory(chartCore, trigger = "viewport") {
  const now = Date.now();
  if (now - lastHistoryCheck < 300) return; // не чаще 2 раз в секунду
  lastHistoryCheck = now;
  checkAndLoadHistory(chartCore, trigger);
}

// --- подключение сокета ---
function connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);
  chartCore._candleSocket = ws;
  //ws.onopen = () => console.log("[candles] socket OPEN");
  ws.onerror = e => console.warn("[candles] socket ERROR", e);
  ws.onclose = e => {
    console.warn("[candles] socket CLOSE", e.code, e.reason);
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(
        () => connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }),
        800
      );
    }
  };
  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);
      if (!("open" in data) || !("close" in data)) return;

      const style = chartCore.state.chartStyle || "candles";
      const intervalMs = chartCore.state.tfMs || 60000;
      let ts = data.timestamp ?? data.time ?? data.openTime;
      if (!ts) return;
      if (ts < 1e12) ts *= 1000;
      let tsFinal = (style === "line")
        ? Math.floor(ts / 1000) * 1000
        : Math.floor(ts / intervalMs) * intervalMs;

      const norm = {
        open:   num(data.open   ?? data.price ?? data.c ?? data.close),
        high:   num(data.high   ?? data.price ?? data.c ?? data.close),
        low:    num(data.low    ?? data.price ?? data.c ?? data.close),
        close:  num(data.close  ?? data.price ?? data.c ?? data.lastPrice),
        volume: num(data.volume),
        time: tsFinal,
        timestamp: tsFinal
      };

      updateLastCandle(chartCore, norm);
      chartCore.state.candlesModule?.render();
      onUpdate?.();

      // >>> вот здесь обновляем плашку
      if (typeof data.price === "number" && typeof data.closeTime === "number") {
        chartCore.state.livePrice?.updatePrice(data.price, data.closeTime, data.serverTime);
      }

    } catch (err) {
      console.warn("[candles] parse error:", err);
    }
  };
}

// --- обновление последней свечи ---
export function updateLastCandle(chartCore, candle) {
  const arr = chartCore.state.candles;

  // если свечей ещё нет — просто добавляем первую
  if (!arr.length) {
    arr.push(candle);
    chartCore.state._needRedrawCandles = true;

    // сразу обновляем livePrice по первой свече
    if (chartCore.state.livePrice) {
      const tfSec = Number(chartCore.state.timeframe) || 60;
      const baseSec = toSec(candle.time ?? Date.now());
      const closeSec = Math.floor(baseSec / tfSec) * tfSec + tfSec;
      chartCore.state.livePrice.updatePrice(candle.close, closeSec, toSec(Date.now()));
      chartCore.state.livePrice.tick();
    }
    return;
  }

  // обновляем последнюю свечу или добавляем новую
  const last = arr[arr.length - 1];
  if (candle.time === last.time) {
    arr[arr.length - 1] = candle;
  } else if (candle.time > last.time) {
    arr.push(candle);
  } else {
    return;
  }

  chartCore.state._needRedrawCandles = true;

  // коллбек для других модулей
  if (chartCore.state.onCandleUpdate) {
    chartCore.state.onCandleUpdate(candle);
  }

  // >>> обновляем livePrice синхронно с последней свечой
  if (chartCore.state.livePrice) {
    const tfSec = Number(chartCore.state.timeframe) || 60;
    const baseSec = toSec(candle.time ?? Date.now());
    const closeSec = Math.floor(baseSec / tfSec) * tfSec + tfSec;
    chartCore.state.livePrice.updatePrice(candle.close, closeSec, toSec(Date.now()));
  }
}

// хелпер для нормализации времени
function toSec(ts) {
  if (ts == null) return null;
  return ts >= 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
}

// --- сброс курсора ---
export function resetCandleCursor() {
  //console.log("[candles] сброшен тип свечей");
}

// --- преобразование в Heikin Ashi ---
export function toHeikin(candles) {
  if (!candles?.length) return [];
  const res = [];
  candles.forEach((c, i) => {
    if (i === 0) {
      res.push({ ...c });
    } else {
      const prev = res[i - 1];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = (prev.open + prev.close) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      res.push({ open: haOpen, high: haHigh, low: haLow, close: haClose, time: c.time, volume: c.volume });
    }
  });
  return res;
}

// --- автоцентрирование ---
export function autoCenterCandles(chartCore) {
  const { candles, layout } = chartCore.state;
  if (!candles?.length || !layout) return;
  const lastIndex = candles.length - 1;
  const last = candles[lastIndex];
  chartCore.state.offsetX = layout.width / 2 - layout.indexToX(lastIndex);
  const midPrice = (last.high + last.low) / 2;
  const midY = layout.priceToY(midPrice);
  chartCore.state.offsetY = layout.height / 2 - midY;
}

// --- рендер свечей ---
export function drawCandlesOnly(chartCore) {
  const { candles, chartStyle, layout, candleLayer } = chartCore.state;
  if (!candles?.length || !layout) return;
  // --- вычисляем окно видимых свечей ---
  const left = Math.max(0, getLeftVisibleIndex(layout) - 2000);
  const right = Math.min(candles.length, getRightVisibleIndex(layout, candles.length) + 2000);
  const visibleCandles = candles.slice(left, right);
  
  if (chartStyle === "candles") {
    renderCandles(candles, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_candlesG");
  } else if (chartStyle === "heikin") {
    const ha = toHeikin(candles);
    renderCandles(ha, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_candlesG");
  } else if (chartStyle === "line") {
    renderLine(candles, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_lineG");
  } else if (chartStyle === "bars") {
    renderBars(candles, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_barsG");
  }
  updateEndBanner(chartCore);
}

function setVisible(layer, activeKey) {
  ["_candlesG", "_lineG", "_barsG"].forEach(key => {
    if (layer[key]) {
      layer[key].visible = (key === activeKey);
      layer[key].zIndex = (key === activeKey) ? 10 : 1;
    }
  });
  layer.sortChildren();
}

// --- батч-рендер свечей ---
export function renderCandles(series, layer, layout, config) {
  let g = layer._candlesG;
  if (!g || g.destroyed) {
    g = new PIXI.Graphics();
    layer.addChild(g);
    layer._candlesG = g;
  }
  g.clear();
  const candleW = layout.candleWidth * layout.scaleX;
  const bull = config.candles.candleBull;
  const bear = config.candles.candleBear;

  const buffer = 5;
  const startIndex = Math.max(
    0,
    Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer
  );
  const endIndex = Math.min(
    series.length - 1,
    Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / (layout.spacing * layout.scaleX)) + buffer
  );

  for (let i = startIndex; i <= endIndex; i++) {
    const v = series[i];
    if (!v) continue;
    const x = layout.indexToX(i);
    const color = v.close >= v.open ? bull : bear;
    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);

    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });
    const top = Math.min(yOpen, yClose);
    const bot = Math.max(yOpen, yClose);
    const h = Math.max(1, bot - top);
    g.rect(x - candleW / 2, top, candleW, h).fill(color);
  }
}

// --- батч-рендер линии ---
export function renderLine(candles, layer, layout, config) {
  let g = layer._lineG;
  if (!g || g.destroyed) {
    g = new PIXI.Graphics();
    layer.addChild(g);
    layer._lineG = g;
  }
  g.clear();
  const color = config.candles?.lineColor ?? 0xffffff;

  const buffer = 5;
  const startIndex = Math.max(
    0,
    Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer
  );
  const endIndex = Math.min(
    candles.length - 1,
    Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / (layout.spacing * layout.scaleX)) + buffer
  );

  for (let i = startIndex; i <= endIndex; i++) {
    const x = layout.indexToX(i);
    const y = layout.priceToY(candles[i].close);
    if (i === startIndex) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke({ width: 2, color });
}

// --- батч-рендер баров ---
export function renderBars(series, layer, layout, config) {
  let g = layer._barsG;
  if (!g || g.destroyed) {
    g = new PIXI.Graphics();
    layer.addChild(g);
    layer._barsG = g;
  }
  g.clear();
  const candleW = layout.candleWidth * layout.scaleX;
  const bull = config.candles.candleBull;
  const bear = config.candles.candleBear;

  const buffer = 5;
  const startIndex = Math.max(
    0,
    Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer
  );
  const endIndex = Math.min(
    series.length - 1,
    Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / (layout.spacing * layout.scaleX)) + buffer
  );

  for (let i = startIndex; i <= endIndex; i++) {
    const v = series[i];
    if (!v) continue;
    const x = layout.indexToX(i);
    const color = v.close >= v.open ? bull : bear;
    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);

    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });
    g.moveTo(x - candleW / 2, yOpen).lineTo(x, yOpen).stroke({ width: 1, color });
    g.moveTo(x, yClose).lineTo(x + candleW / 2, yClose).stroke({ width: 1, color });
  }
}

export function renderCandlesWindow(series, startIndex, endIndex, layer, layout, config) {
  let g = layer._candlesG;
  if (!g || g.destroyed) { g = new PIXI.Graphics(); layer.addChild(g); layer._candlesG = g; }
  g.clear();
  const candleW = layout.candleWidth * layout.scaleX;
  const bull = config.candles.candleBull;
  const bear = config.candles.candleBear;
  for (let i = startIndex; i <= endIndex; i++) {
    const v = series[i]; if (!v) continue;
    const x = layout.indexToX(i);
    const color = v.close >= v.open ? bull : bear;
    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);
    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });
    const top = Math.min(yOpen, yClose);
    const bot = Math.max(yOpen, yClose);
    const h = Math.max(1, bot - top);
    g.rect(x - candleW / 2, top, candleW, h).fill(color);
  }
}

export function renderLineWindow(series, startIndex, endIndex, layer, layout, config) {
  let g = layer._lineG;
  if (!g || g.destroyed) { g = new PIXI.Graphics(); layer.addChild(g); layer._lineG = g; }
  g.clear();
  const color = config.candles?.lineColor ?? 0xffffff;
  for (let i = startIndex; i <= endIndex; i++) {
    const x = layout.indexToX(i);
    const y = layout.priceToY(series[i].close);
    if (i === startIndex) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke({ width: 2, color });
}

export function renderBarsWindow(series, startIndex, endIndex, layer, layout, config) {
  let g = layer._barsG;
  if (!g || g.destroyed) { g = new PIXI.Graphics(); layer.addChild(g); layer._barsG = g; }
  g.clear();
  const candleW = layout.candleWidth * layout.scaleX;
  const bull = config.candles.candleBull;
  const bear = config.candles.candleBear;
  for (let i = startIndex; i <= endIndex; i++) {
    const v = series[i]; if (!v) continue;
    const x = layout.indexToX(i);
    const color = v.close >= v.open ? bull : bear;
    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);
    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });
    g.moveTo(x - candleW / 2, yOpen).lineTo(x, yOpen).stroke({ width: 1, color });
    g.moveTo(x, yClose).lineTo(x + candleW / 2, yClose).stroke({ width: 1, color });
  }
}
