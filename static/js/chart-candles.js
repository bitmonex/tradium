//chart-candles.js
//@param {object} candle – { open, high, low, close, volume, isFinal, ... }
export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core || !core.state || !Array.isArray(core.state.candles)) return;

  const arr = core.state.candles;
  if (candle.isFinal) {
    // зафайналенная свеча → удаляем первую и пушим новую
    arr.shift();
    arr.push(candle);
  } else {
    // обновляем незакрытую свечу
    arr[arr.length - 1] = candle;
  }

  // рисуем только слой свечей (drawCandlesOnly будет экспортирован из core)
  if (typeof core.drawCandlesOnly === 'function') {
    core.drawCandlesOnly();
  } else {
    // fallback на полный redraw
    core.draw({ candles: arr, volumes: core.state.volumes });
  }
}