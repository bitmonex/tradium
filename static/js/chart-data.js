//chart-data.js
export async function loadChartData(exchange, marketType, symbol, timeframe) {
  const res = await fetch(`/${exchange}/${marketType}/${symbol}/history?tf=${timeframe}`);
  const raw = await res.json();
  const candles = [], volumes = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const t = Math.floor(c.timestamp);
    const o = +c.open, h = +c.high, l = +c.low, cl = +c.close, v = +c.volume;
    if ([o, h, l, cl, v].some(isNaN)) continue;
    candles.push({ time: t, open: o, high: h, low: l, close: cl, volume: v });
    volumes.push({ time: t, value: v });
  }
  return { candles, volumes };
}
