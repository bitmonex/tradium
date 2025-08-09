export const meta = {
    id: "sma",
    name: "SMA",
    variants: [
        { id: "sma50", period: 50, color: "#ffaa00" },
        { id: "sma200", period: 200, color: "#00ffaa" }
    ]
};

export function createIndicator({ period, color }, chart, history) {
    console.log(`🟡 SMA init — period: ${period}, length: ${history.length}`);
    if (history.length < period) {
        console.warn("⚠️ Недостаточно истории для SMA:", period);
        return null;
    }

    const line = chart.addLineSeries({ color, lineWidth: 1 });
    const smaData = history.slice(period - 1).map((_, i) => {
        const slice = history.slice(i, i + period);
        const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
        return { time: slice[period - 1].time, value: avg };
    });

    line.setData(smaData);
    return line;
}
