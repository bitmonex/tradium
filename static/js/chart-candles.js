// chart-candles.js
let lastCandleRef = null, lastTs = null;

export const candleRenderSettings = {
  barTickRatio: 0.9,
  barTickLen: 6,
  barLineWidth: 1.5,
  lineWidth: 1.5,
  lineColor: 0xffffff
};
window.candleRenderSettings = candleRenderSettings;

export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core) return;
  const arr = core.state.candles;

  const intervalMs = core.state.tfMs || 60000;
  let ts = candle.timestamp ?? candle.time ?? Date.now();
  if (!ts) return;
  if (ts < 1e12) ts *= 1000;

  // --- LINE режим ---
  if (core.state.chartStyle === "line") {
    const c = toNum(candle.close ?? candle.price ?? candle.c ?? candle.lastPrice);
    if (!isFinite(c)) {
      console.warn("⚠️ LINE: нет валидного close", candle);
      return;
    }

    const last = arr[arr.length - 1];

    if (last && last.timestamp === candle.timestamp) {
      // обновляем текущую точку
      last.open = last.high = last.low = last.close = c;
    } else if (!last || candle.timestamp > last.timestamp) {
      // новый интервал — создаём новую точку
      arr.push({
        open: c, high: c, low: c, close: c,
        volume: 0,
        timestamp: candle.timestamp
      });
    } else {
      // тик со старым временем — обновляем последнюю
      last.open = last.high = last.low = last.close = c;
    }

    core.state._needRedrawCandles = true;
    return;
  }

  // --- BARS режим ---
  ts = Math.floor(ts / intervalMs) * intervalMs;
  if (core.state.chartStyle === "bars") {
    const obj = {
      open: toNum(candle.open),
      high: toNum(candle.high),
      low:  toNum(candle.low),
      close: toNum(candle.close ?? candle.price),
      volume: toNum(candle.volume),
      timestamp: ts
    };

    const last = arr[arr.length - 1];
    if (!last || last.timestamp !== ts) {
      arr.push(obj);
      lastCandleRef = arr[arr.length - 1];
      lastTs = ts;
    } else {
      last.open   = obj.open   ?? last.open;
      last.close  = obj.close  ?? last.close;
      last.volume = obj.volume ?? last.volume;
      if (isFinite(obj.high) && (last.high == null || obj.high > last.high)) last.high = obj.high;
      if (isFinite(obj.low)  && (last.low  == null || obj.low  < last.low))  last.low  = obj.low;
      lastCandleRef = last;
      lastTs = ts;
    }

    core.state._needRedrawCandles = true;
    return;
  }

  // --- свечи / heikin ---
  ts = Math.floor(ts / intervalMs) * intervalMs;

  if (!lastCandleRef || lastCandleRef !== arr[arr.length - 1]) {
    lastCandleRef = arr[arr.length - 1];
    lastTs = lastCandleRef?.timestamp;
  }

  if (!lastCandleRef) {
    const obj = {
      open: toNum(candle.open),
      high: toNum(candle.high),
      low:  toNum(candle.low),
      close: toNum(candle.close ?? candle.price),
      volume: toNum(candle.volume),
      timestamp: ts
    };
    arr.push(obj);
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else if (lastTs === ts) {
    lastCandleRef.open   = toNum(candle.open)   ?? lastCandleRef.open;
    lastCandleRef.close  = toNum(candle.close ?? candle.price) ?? lastCandleRef.close;
    lastCandleRef.volume = toNum(candle.volume) ?? lastCandleRef.volume;

    const h = toNum(candle.high);
    const l = toNum(candle.low);
    if (isFinite(h) && (lastCandleRef.high == null || h > lastCandleRef.high)) lastCandleRef.high = h;
    if (isFinite(l) && (lastCandleRef.low == null || l < lastCandleRef.low))  lastCandleRef.low  = l;
  } else if (ts > lastTs) {
    const obj = {
      open: toNum(candle.open),
      high: toNum(candle.high),
      low:  toNum(candle.low),
      close: toNum(candle.close ?? candle.price),
      volume: toNum(candle.volume),
      timestamp: ts
    };
    arr.push(obj);
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else {
    arr[arr.length - 1] = {
      open: toNum(candle.open),
      high: toNum(candle.high),
      low:  toNum(candle.low),
      close: toNum(candle.close ?? candle.price),
      volume: toNum(candle.volume),
      timestamp: ts
    };
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  }

  core.state._needRedrawCandles = true;

  if (core.state.chartStyle !== "line" && core.state.chartStyle !== "bars") {
    core.state.ohlcv?.update?.(lastCandleRef, { force: true });
  }
}

function toNum(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) ? n : undefined;
}
