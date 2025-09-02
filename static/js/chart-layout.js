// chart-layout.js

export function createLayout(
  app,           // нужен только для width/height
  config,
  candles,       // массив свечей для вычисления domain
  offsetX,       // сдвиг по X в пикселях
  offsetY,       // сдвиг по Y
  scaleX,        // масштаб X
  scaleY,        // масштаб Y
  tfMs           // таймфрейм в мс (вычислили заранее в ядре)
) {
  const width  = app.renderer.width;
  const height = app.renderer.height;

  // один раз считаем domain
  const spacing = config.candleWidth + config.spacing;
  const prices  = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
  const min     = Math.min(...prices);
  const max     = Math.max(...prices);
  const range   = max - min || 1;
  const time0   = candles[0]?.time ?? 0;

  // Перевод цены → Y
  function priceToY(price) {
    return (
      ((height - config.bottomOffset) * (1 - (price - min) / range))
      * scaleY
      + offsetY
    );
  }

  // Перевод временной метки → X
  function timeToX(ts) {
    const delta = (ts - time0) / tfMs;
    return offsetX + delta * spacing * scaleX;
  }

  // Перевод индекса свечи → X
  function indexToX(idx) {
    return offsetX + idx * spacing * scaleX;
  }

  // Перевод пикселя X → время
  function screenToTime(x) {
    const frac = (x - offsetX) / (spacing * scaleX);
    return time0 + frac * tfMs;
  }

  return {
    width,
    height,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    tfMs,
    spacing,
    priceToY,
    timeToX,
    indexToX,
    screenToTime
  };
}
