//chart-tf.js
export function TF(candles) {
  if (!candles || candles.length < 2) return 30 * 60 * 1000;
  return candles[1].time - candles[0].time;
}