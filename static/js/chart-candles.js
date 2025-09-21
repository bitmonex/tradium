//chart-candles.js
let lastCandleRef = null, lastTs = null;

export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core?.state?.candles?.length) return;
  const arr = core.state.candles;

  if (!lastCandleRef || lastCandleRef !== arr[arr.length - 1]) {
    lastCandleRef = arr[arr.length - 1];
    lastTs = lastCandleRef.timestamp;
  }

  const intervalMs = core.state.tfMs || 60000;
  let ts = candle.timestamp ?? candle.time;
  if (!ts) return;
  if (ts < 1e12) ts *= 1000;
  ts = Math.floor(ts / intervalMs) * intervalMs;

  if (!lastCandleRef) {
    arr.push({ ...candle, timestamp: ts });
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else if (lastTs === ts) {
    lastCandleRef.open = candle.open;
    lastCandleRef.close = candle.close;
    lastCandleRef.price = candle.price;
    lastCandleRef.volume = candle.volume;
    if (candle.high > lastCandleRef.high) lastCandleRef.high = candle.high;
    if (candle.low < lastCandleRef.low) lastCandleRef.low = candle.low;
  } else if (ts > lastTs) {
    arr.push({ ...candle, timestamp: ts });
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else {
    arr[arr.length - 1] = { ...candle, timestamp: ts };
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  }

  core.state._needRedrawCandles = true;
  core.drawCandlesOnly?.();
  core.state.ohlcv?.update?.(lastCandleRef, { force: true });
}