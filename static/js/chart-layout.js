// chart-layout.js
export function createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY, tfMs, bottomHeight = 0) {
  if (!app?.renderer) {
    return null;
  }
  const width = app.renderer.width;
  const height = app.renderer.height;

  // базовые геометрические параметры
  const candleWidth = config.candleWidth ?? 6;
  const spacing = (config.spacing ?? 2) + candleWidth;
  const rightOffset = config.rightOffset ?? 70;
  const bottomOffset = config.bottomOffset ?? 30;

  // диапазон цен
  const prices = candles.length
    ? candles.flatMap(c => [c.open, c.high, c.low, c.close])
    : [0, 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const time0 = candles[0]?.time ?? 0;

  // --- функции преобразования ---
  const priceToY = (price) =>
    ((height - bottomOffset - bottomHeight) * (1 - (price - min) / range)) * scaleY + offsetY;

  const timeToX = (ts) =>
    offsetX + ((ts - time0) / tfMs) * spacing * scaleX;

  const indexToX = (idx) =>
    offsetX + idx * spacing * scaleX;

  const screenToTime = (x) =>
    time0 + ((x - offsetX) / (spacing * scaleX)) * tfMs;

  const screenToPrice = (y) =>
    min + (1 - (y - offsetY) / ((height - bottomOffset - bottomHeight) * scaleY)) * range;

  // координаты рабочей области графика
  const plotX = 0;
  const plotY = 0;
  const plotW = width - rightOffset;
  const plotH = height - bottomOffset - bottomHeight; // 🔹 ключевой момент

  return {
    width,
    height,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    tfMs,
    candleWidth,
    spacing,
    rightOffset,
    bottomOffset,
    min,
    max,
    range,
    time0,
    priceToY,
    timeToX,
    indexToX,
    screenToTime,
    screenToPrice,
    plotX,
    plotY,
    plotW,
    plotH
  };
}

//автоцентрирование
export function autoCenterCandles(chartCore) {
  const { candles, layout } = chartCore.state;
  if (!candles?.length || !layout) return;

  const lastIndex = candles.length - 1;
  const last = candles[lastIndex];

  // --- Центр по X ---
  chartCore.state.offsetX = layout.width / 2 - layout.indexToX(lastIndex);

  // --- Центр по Y ---
  const midPrice = (last.high + last.low) / 2; // середина последней свечи
  const midY = layout.priceToY(midPrice);
  chartCore.state.offsetY = layout.height / 2 - midY;
}

