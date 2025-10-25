// chart-data.js
// базовая загрузка
export async function loadChartData(exchange, marketType, symbol, timeframe) {
  const res = await fetch(`/${exchange}/${marketType}/${symbol}/history?tf=${timeframe}`);
  const raw = await res.json();
  const candles = [], volumes = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    let t = Math.floor(c.timestamp);
    if (t < 1e12) t *= 1000; // секунды → миллисекунды
    const o = +c.open, h = +c.high, l = +c.low, cl = +c.close, v = +c.volume;
    if ([o, h, l, cl, v].some(isNaN)) continue;
    candles.push({ time: t, open: o, high: h, low: l, close: cl, volume: v });
    volumes.push({ time: t, value: v });
  }
  return { candles, volumes };
}

// догрузка истории чанками
export async function loadMoreCandles(exchange, marketType, symbol, timeframe, before, limit = 2000) {
  const url = `/${exchange}/${marketType}/${symbol}/history?tf=${timeframe}&before=${before}&limit=${limit}`;
  console.log(`[loadMoreCandles] URL запрос: ${url}`);

  const res = await fetch(url);
  const raw = await res.json();

  const candles = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    let t = Math.floor(c.timestamp);
    if (t < 1e12) t *= 1000;
    const o = +c.open, h = +c.high, l = +c.low, cl = +c.close, v = +c.volume;
    if ([o, h, l, cl, v].some(isNaN)) continue;
    candles.push({ time: t, open: o, high: h, low: l, close: cl, volume: v });
  }

  console.log(`[loadMoreCandles] Получено свечей: ${candles.length}`);
  return candles;
}
