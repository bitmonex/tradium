//chart-candles.js
export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core || !core.state || !Array.isArray(core.state.candles)) return;

  const arr = core.state.candles;
  if (arr.length === 0) {
    arr.push(candle);
    return;
  }

  const last = arr[arr.length - 1];

  if (candle.isFinal) {
    arr.shift();
    arr.push(candle);
  } else if (last && last.timestamp === candle.timestamp) {
    last.open = candle.open;
    last.close = candle.close;
    last.price = candle.price;
    last.volume = candle.volume;

    // тень накапливается, даже если цена откупилась
    last.high = Math.max(last.high, candle.high, candle.price);
    last.low = Math.min(last.low, candle.low, candle.price);
  } else {
    // новая незакрытая свеча
    arr[arr.length - 1] = {
      ...candle,
      high: candle.price,
      low: candle.price,
      volume: 0,
      isFinal: false
    };
  }

  if (typeof core.drawCandlesOnly === 'function') {
    core.drawCandlesOnly();
  } else {
    core.draw({ candles: arr, volumes: core.state.volumes });
  }
}
