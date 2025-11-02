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

  // координаты рабочей области графика
  const plotX = 0;
  const plotY = 0;
  const plotW = width - rightOffset;
  const plotH = height - bottomOffset - bottomHeight; // 🔹 ключевой момент

  // --- создаём layout как объект, а функции читают его актуальные поля ---
  const layout = {
    width,
    height,
    // динамические параметры — будут обновляться при рендерах
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    tfMs,

    // статические параметры
    candleWidth,
    spacing,
    rightOffset,
    bottomOffset,
    min,
    max,
    range,
    time0,

    // рабочая область
    plotX,
    plotY,
    plotW,
    plotH
  };

  // --- функции преобразования читают layout.*, а не замыкания ---
  layout.priceToY = (price) =>
    ((layout.height - layout.bottomOffset - bottomHeight) * (1 - (price - layout.min) / layout.range)) * layout.scaleY + layout.offsetY;

  layout.timeToX = (ts) =>
    layout.offsetX + ((ts - layout.time0) / layout.tfMs) * layout.spacing * layout.scaleX;

  layout.indexToX = (idx) =>
    layout.offsetX + idx * layout.spacing * layout.scaleX;

  layout.screenToTime = (x) =>
    layout.time0 + ((x - layout.offsetX) / (layout.spacing * layout.scaleX)) * layout.tfMs;

  layout.screenToPrice = (y) =>
    layout.min + (1 - (y - layout.offsetY) / ((layout.height - layout.bottomOffset - bottomHeight) * layout.scaleY)) * layout.range;

  return layout;
}

// автоцентрирование
export function autoCenterCandles(chartCore) {
  const { candles, layout } = chartCore.state;
  if (!candles?.length || !layout) return;

  const lastIndex = candles.length - 1;
  const last = candles[lastIndex];

  // --- Центр по X ---
  chartCore.state.offsetX = layout.width / 2 - layout.indexToX(lastIndex);

  // --- Центр по Y с учётом plot‑зоны ---
  const midPrice = (last.high + last.low) / 2;
  const midY = layout.priceToY(midPrice);
  const plotCenterY = layout.plotY + layout.plotH / 2;
  chartCore.state.offsetY = plotCenterY - midY;
}
