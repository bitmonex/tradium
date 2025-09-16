//chart-candles.js
export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core?.state?.candles) return;

  const arr = core.state.candles;
  const tf = core.state.interval || '1m';
  const intervalSec = typeof tf === 'string' ? tfToSeconds(tf) : tf;
  const intervalMs = intervalSec * 1000;

  let rawTs = candle.timestamp ?? candle.time;
  if (!rawTs) return;
  if (rawTs < 1e12) rawTs *= 1000; // если в секундах → в мс

  const ts = Math.floor(rawTs / intervalMs) * intervalMs;
  const last = arr[arr.length - 1];

  if (!last) {
    arr.push({ ...candle, timestamp: ts });
  } else if (last.timestamp === ts) {
    // обновляем текущую свечу
    last.open = candle.open;
    last.close = candle.close;
    last.price = candle.price;
    last.volume = candle.volume;
    last.high = Math.max(last.high, candle.high);
    last.low = Math.min(last.low, candle.low);
  } else if (ts > last.timestamp) {
    // новый интервал → пушим новую свечу
    arr.push({ ...candle, timestamp: ts });
  } else {
    // если пришли странные данные — хотя бы обновим последнюю
    arr[arr.length - 1] = { ...candle, timestamp: ts };
  }

  if (typeof core.drawCandlesOnly === 'function') core.drawCandlesOnly();
  else core.draw({ candles: arr, volumes: core.state.volumes });
}

function tfToSeconds(tf) {
  const num = parseInt(tf);
  if (tf.endsWith('m')) return num * 60;
  if (tf.endsWith('h')) return num * 3600;
  if (tf.endsWith('d')) return num * 86400;
  if (tf.endsWith('w')) return num * 604800;
  if (tf.endsWith('M')) return num * 2592000;
  return 60;
}
