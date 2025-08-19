// chart-utils.js

export function getAdaptiveStepX(scaleX, candleWidth, spacing) {
  const spacingPx = (candleWidth + spacing) * scaleX;
  const minSpacing = 100;
  if (spacingPx < minSpacing) {
    const boostFactor = Math.ceil(minSpacing / spacingPx);
    return Math.max(1, boostFactor);
  }
  return 1;
}

export function getAdaptiveStepY(scaleY) {
  const baseStep = 50;
  const minStep = 30;
  const zoomedStep = Math.round(baseStep * scaleY);
  return Math.max(minStep, zoomedStep);
}

export function formatTime(timestamp, tfMs) {
  const date = new Date(timestamp);
  if (tfMs >= 86400000) {
    return date.toLocaleDateString(); // дни
  } else if (tfMs >= 3600000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // часы
  } else {
    return date.toLocaleTimeString(); // минуты/секунды
  }
}

export function formatPrice(price) {
  if (price >= 1000) return price.toFixed(0);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}
