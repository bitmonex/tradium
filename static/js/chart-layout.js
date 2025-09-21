// chart-layout.js
export function createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY, tfMs) {
  const width = app.renderer.width, height = app.renderer.height;
  const spacing = config.candleWidth + config.spacing;
  const prices = candles.length ? candles.flatMap(c => [c.open, c.high, c.low, c.close]) : [0, 1];
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const time0 = candles[0]?.time ?? 0;

  const priceToY = price => ((height - config.bottomOffset) * (1 - (price - min) / range)) * scaleY + offsetY;
  const timeToX = ts => offsetX + ((ts - time0) / tfMs) * spacing * scaleX;
  const indexToX = idx => offsetX + idx * spacing * scaleX;
  const screenToTime = x => time0 + ((x - offsetX) / (spacing * scaleX)) * tfMs;

  return { width, height, offsetX, offsetY, scaleX, scaleY, tfMs, spacing, priceToY, timeToX, indexToX, screenToTime };
}
