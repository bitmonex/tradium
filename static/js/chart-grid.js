// chart-grid.js

import {
  getAdaptiveStepX,
  getAdaptiveStepY,
  formatTime,
  formatPrice
} from './chart-utils.js';

export function computeGrid(layout, settings) {
  if (!settings?.grid?.enabled || !layout.candles?.length) return null;

  const {
    width,
    height,
    config,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    candles
  } = layout;
  const { candleWidth, spacing, rightOffset = 0, bottomOffset = 0 } = config;

  // горизонтальные/вертикальные шаги
  let stepX = getAdaptiveStepX(scaleX, candleWidth, spacing);
  if (scaleX < 0.3 && stepX < 10) stepX = 10;
  const stepY = getAdaptiveStepY(scaleY);

  const totalSpacing = candleWidth + spacing;
  const candleCount = candles.length;
  const extension = settings.grid.futureExtension ?? 10;
  const extended = candleCount + extension;
  const anchor = Math.floor(candleCount / 2);

  const linesX = [];
  const linesY = [];

  // вертикальные линии
  for (let i = -Math.floor(anchor / stepX); i <= Math.floor((extended - anchor) / stepX); i++) {
    const idx = anchor + i * stepX;
    if (idx < 0 || idx >= extended) continue;
    const x = offsetX + idx * totalSpacing * scaleX + (candleWidth * scaleX) / 2;
    if (x >= 0 && x <= width - rightOffset) linesX.push(x);
  }

  // расширение сетки вправо/влево
  const px = stepX * totalSpacing * scaleX;
  let last = linesX.at(-1), first = linesX[0];
  while (last + px <= width - rightOffset) { last += px; linesX.push(last); }
  while (first - px >= 0) { first -= px; linesX.unshift(first); }

  // горизонтальные линии
  const startY = (offsetY % stepY + stepY) % stepY;
  for (let y = startY; y < height - bottomOffset; y += stepY) {
    linesY.push(y);
  }

  return {
    verticalLines: linesX,
    horizontalLines: linesY
  };
}

export function getTimeTicks(layout) {
  const grid = computeGrid(layout, { grid: { enabled: true, futureExtension: 0 } });
  if (!grid) return [];

  return grid.verticalLines.map(x => {
    const t = layout.screen2t(x);
    return {
      x,
      label: formatTime(t, layout.tfMs)
    };
  });
}

export function getPriceTicks(layout) {
  const grid = computeGrid(layout, { grid: { enabled: true } });
  if (!grid) return [];

  // восстанавливаем диапазон цены по свечам
  const prices = layout.candles.flatMap(c => [c.open, c.high, c.low, c.close]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  return grid.horizontalLines.map(y => {
    // обратное преобразование y → цена
    const rawY = (y - layout.offsetY) / layout.scaleY;
    const ratio = 1 - rawY / (layout.height - layout.config.bottomOffset);
    const price = minPrice + ratio * range;

    return {
      y,
      label: formatPrice(price)
    };
  });
}
