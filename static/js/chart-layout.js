import { detectTimeframe } from './chart-tf.js';

export function getLayout(app, config, group, candles, offsetX, offsetY, scaleX, scaleY) {
  const width = app.renderer.width;
  const height = app.renderer.height;
  const tfMs = detectTimeframe(candles);
  const spacing = config.candleWidth + config.spacing;

  function priceToY(price) {
    const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    return ((height - config.bottomOffset) * (1 - (price - min) / range)) * scaleY + offsetY;
  }

  function timestampToX(index) {
    return offsetX + index * spacing * scaleX;
  }

  function timeToX(timestamp) {
    const time0 = candles?.[0]?.time ?? timestamp;
    const deltaMs = timestamp - time0;
    return offsetX + (deltaMs / tfMs) * spacing * scaleX;
  }

  return {
    app,
    config,
    group,
    candles,
    width,
    height,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    priceToY,
    timestampToX,
    timeToX
  };
}
