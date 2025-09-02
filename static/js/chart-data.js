//chart-data.js
export async function loadChartData(exchange, marketType, symbol, timeframe) {
    const url = `/${exchange}/${marketType}/${symbol}/history?tf=${timeframe}`;
    console.log("Запрос:", url);
    const res = await fetch(url);
    const raw = await res.json();
    const candles = [], volumes = [];
    for (const c of raw) {
        const time = Math.floor(c.timestamp);
        const open = parseFloat(c.open);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const close = parseFloat(c.close);
        const volume = parseFloat(c.volume);
        if ([open, high, low, close, volume].some(v => isNaN(v))) continue;
        candles.push({ time, open, high, low, close, volume });
        volumes.push({ time, value: volume });
    }
    return { candles, volumes };
}