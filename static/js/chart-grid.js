import { ChartConfig } from './chart-config.js';
import { formatTime, formatPrice } from './chart-utils.js';

function getAdaptiveStepX(scaleX, candleWidth, spacing) {
  const spacingPx = (candleWidth + spacing) * scaleX;
  const minSpacing = 100;
  if (spacingPx < minSpacing) {
    const boostFactor = Math.ceil(minSpacing / spacingPx);
    return Math.max(1, boostFactor);
  }
  return 1;
}

function getAdaptiveStepY(scaleY) {
  const baseStep = 50;
  const minStep = 30;
  const zoomedStep = Math.round(baseStep * scaleY);
  return Math.max(minStep, zoomedStep);
}

export function computeGrid(layout, settings) {
  if (!ChartConfig.grid.gridEnabled || !settings?.grid?.enabled || !layout?.candles?.length) return null;

  const {
    width: w,
    height: h,
    config: { candleWidth, spacing, rightOffset = 0, bottomOffset = 0 },
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    candles
  } = layout;

  const futureExtension = settings.grid.futureExtension ?? 10;
  const totalSpacing = candleWidth + spacing;
  const candleCount = candles.length;
  const extendedCount = candleCount + futureExtension;

  let stepX = getAdaptiveStepX(scaleX, candleWidth, spacing);
  if (scaleX < 0.3 && stepX < 10) stepX = 10;
  const stepY = getAdaptiveStepY(scaleY);

  const anchorIndex = Math.floor(candleCount / 2);
  const verticalLines = [];
  const horizontalLines = [];

  const candleCenter = i => offsetX + i * totalSpacing * scaleX + (candleWidth * scaleX) / 2;

  for (let i = -Math.floor(anchorIndex / stepX); i <= Math.floor((extendedCount - anchorIndex) / stepX); i++) {
    const index = anchorIndex + i * stepX;
    if (index < 0 || index >= extendedCount) continue;
    const x = candleCenter(index);
    if (x >= 0 && x <= w - rightOffset) {
      verticalLines.push(x);
    }
  }

  const stepPx = stepX * totalSpacing * scaleX;
  let extraX = verticalLines.at(-1) + stepPx;
  const maxExtraLines = 100;
  while (extraX <= w - rightOffset && verticalLines.length < maxExtraLines) {
    verticalLines.push(extraX);
    extraX += stepPx;
  }

  let extraLeftX = verticalLines[0] - stepPx;
  while (extraLeftX >= 0 && verticalLines.length < maxExtraLines * 2) {
    verticalLines.unshift(extraLeftX);
    extraLeftX -= stepPx;
  }

  const startY = (offsetY % stepY + stepY) % stepY;
  for (let y = startY; y < h - bottomOffset; y += stepY) {
    horizontalLines.push(y);
  }

  return {
    verticalLines,
    horizontalLines
  };
}

export function getTimeGridLines(layout) {
  const {
    width: w,
    config: { candleWidth, spacing, rightOffset = 0 },
    scaleX,
    offsetX,
    tfMs,
    screen2t
  } = layout;

  const totalSpacing = candleWidth + spacing;
  const spacingPx = totalSpacing * scaleX;
  const stepPx = Math.max(spacingPx * 10, 80);
  const lines = [];

  for (let x = 0; x < w - rightOffset; x += stepPx) {
    const t = screen2t(x);
    const label = formatTime(t, tfMs);
    lines.push({ x, label });
  }

  return lines;
}

export function getPriceGridLines(layout) {
  const {
    height: h,
    config: { bottomOffset = 30 },
    scaleY,
    offsetY,
    screen2$
  } = layout;

  const stepY = Math.max(30, Math.round(50 * scaleY));
  const lines = [];

  const startY = (offsetY % stepY + stepY) % stepY;
  for (let y = startY; y < h - bottomOffset; y += stepY) {
    const price = screen2$(y);
    const label = formatPrice(price);
    lines.push({ y, label });
  }

  return lines;
}
