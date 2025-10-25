// chart-candles.js
import { num } from './chart-utils.js';

// --- настройки рендера свечей ---
export const candleRenderSettings = {
  candleWidth: 6,
  candleGap: 2,
};

// --- инициализация свечей ---
export function initCandles(chartCore, chartSettings) {
  chartCore._alive = true;
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
  } catch (err) {
    console.error("[candles] loadOHLCV error:", err);
  }
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
  if (chartCore.state.noMoreData && chartCore.state.offsetX > 0) {
    chartCore.state.offsetX = 0;
  }
}

// --- утилита агрегации ---
function aggregateCandles(candles, bucketSize) {
  if (!candles?.length || bucketSize <= 1) return candles;

  const aggregated = [];
  for (let i = 0; i < candles.length; i += bucketSize) {
    const bucket = candles.slice(i, i + bucketSize);
    if (!bucket.length) continue;

    const open = bucket[0].open;
    const close = bucket[bucket.length - 1].close;
    const high = Math.max(...bucket.map(c => c.high));
    const low = Math.min(...bucket.map(c => c.low));
    const volume = bucket.reduce((sum, c) => sum + (c.volume || 0), 0);
    const time = bucket[0].time;

    aggregated.push({ open, high, low, close, volume, time });
  }
  return aggregated;
}

// --- рендер свечей с LOD ---
export function drawCandlesOnly(chartCore) {
  const { candles, chartStyle, layout, candleLayer } = chartCore.state;
  if (!candles?.length || !layout) return;

  let series = candles;

  // --- LOD агрегация ---
  const maxBars = layout.plotW; // ширина области в пикселях
  if (candles.length > maxBars * 2) {
    const bucketSize = Math.ceil(candles.length / maxBars);
    series = aggregateCandles(candles, bucketSize);
    // console.log(`[LOD] Агрегация: ${candles.length} → ${series.length}`);
  }

  if (chartStyle === "candles") {
    renderCandles(series, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_candlesG");
  } else if (chartStyle === "heikin") {
    const ha = toHeikin(series);
    renderCandles(ha, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_candlesG");
  } else if (chartStyle === "line") {
    renderLine(series, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_lineG");
  } else if (chartStyle === "bars") {
    renderBars(series, candleLayer, layout, chartCore.config);
    setVisible(candleLayer, "_barsG");
  }
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

  // --- вычисляем диапазон индексов для отрисовки ---
  const buffer = 5; // запас в свечах слева/справа
  const startIndex = Math.max(0, Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer);
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

    // тень high-low
    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });

    // тело свечи
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
  const startIndex = Math.max(0, Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer);
  const endIndex = Math.min(
    candles.length - 1,
    Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / (layout.spacing * layout.scaleX)) + buffer
  );
  for (let i = startIndex; i <= endIndex; i++) {
    const x = layout.indexToX(i);
    const y = layout.priceToY(candles[i].close);
    if (i === startIndex) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
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
  const startIndex = Math.max(0, Math.floor((layout.plotX - layout.offsetX) / (layout.spacing * layout.scaleX)) - buffer);
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
    // high-low
    g.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color });
    // open слева
    g.moveTo(x - candleW / 2, yOpen).lineTo(x, yOpen).stroke({ width: 1, color });
    // close справа
    g.moveTo(x, yClose).lineTo(x + candleW / 2, yClose).stroke({ width: 1, color });
  }
}

