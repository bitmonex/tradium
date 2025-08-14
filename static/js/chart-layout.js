import { detectTimeframe } from './chart-tf.js';

export function createLayout(app, config, candles, offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1, group = null) {
  const width = app.renderer.width;
  const height = app.renderer.height;
  const tfMs = detectTimeframe(candles);
  const spacing = config.candleWidth + config.spacing;

  // 📈 Преобразование цены в координату Y
  function priceToY(price) {
    const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    return ((height - config.bottomOffset) * (1 - (price - min) / range)) * scaleY + offsetY;
  }

  // 🕒 Индекс свечи → X
  function timestampToX(index) {
    return offsetX + index * spacing * scaleX;
  }

  // 🕰️ Время → X
  function timeToX(timestamp) {
    const time0 = candles?.[0]?.time ?? timestamp;
    const deltaMs = timestamp - time0;
    return offsetX + (deltaMs / tfMs) * spacing * scaleX;
  }

  // 🔄 Экран → время
  function screen2t(x) {
    const time0 = candles?.[0]?.time ?? 0;
    const delta = (x - offsetX) / (spacing * scaleX);
    return time0 + delta * tfMs;
  }

  // 🔄 Время → экран
  function t2screen(t) {
    return timeToX(t);
  }

  return {
    app,
    config,
    candles,
    width,
    height,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    tfMs,
    spacing,
    group,
    priceToY,
    timestampToX,
    timeToX,
    screen2t,
    t2screen
  };
}
