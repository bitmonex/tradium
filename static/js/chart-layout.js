// chart-layout.js
export function createLayout(
  app, config, candles,
  offsetX, offsetY,
  scaleX, scaleY,
  tfMs, bottomHeight = 0,
  priceWindow = null
) {
  if (!app?.renderer) return null;
  const width = app.renderer.width;
  const height = app.renderer.height;

  const candleWidth = config.candleWidth ?? 6;
  const spacing = (config.spacing ?? 2) + candleWidth;
  const rightOffset = config.rightOffset ?? 70;
  const bottomOffset = config.bottomOffset ?? 30;

  // time0 всегда по ГЛОБАЛЬНОМУ массиву
  const time0 = candles[0]?.time ?? 0;

  // min/max считаем по окну, если передано; иначе по всему массиву
  const src = Array.isArray(priceWindow) && priceWindow.length ? priceWindow : candles;
  const prices = src.length
    ? src.flatMap(c => [c.open, c.high, c.low, c.close])
    : [0, 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const plotX = 0;
  const plotY = 0;
  const plotW = width - rightOffset;
  const plotH = height - bottomOffset - bottomHeight;

  const layout = {
    width, height,
    offsetX, offsetY, scaleX, scaleY, tfMs,
    candleWidth, spacing, rightOffset, bottomOffset,
    min, max, range, time0,
    plotX, plotY, plotW, plotH
  };

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
