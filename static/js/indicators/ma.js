export function createIndicator(params, env, candles) {
  const { group, width, height, scaleX, scaleY, offsetX, offsetY } = env;

  const layer = new PIXI.Container();
  group.addChild(layer);

  const period = params.period || 14;
  const maLine = new PIXI.Graphics();
  layer.addChild(maLine);

  function calculateMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      result.push(sum / period);
    }
    return result;
  }

  const maValues = calculateMA(candles, period);

  function render(layout) {
    maLine.clear();
    maLine.lineStyle(2, 0xffd700); // Золотой цвет

    const cw = env.config.candleWidth + env.config.spacing;
    const { minPrice, maxPrice } = layout;
    const priceRange = maxPrice - minPrice || 1;

    for (let i = 0; i < maValues.length; i++) {
      const val = maValues[i];
      if (val === null) continue;

      const x = i * cw * scaleX + offsetX;
      const y = ((height - env.config.bottomOffset) * (1 - (val - minPrice) / priceRange)) * scaleY + offsetY;

      if (i === period - 1) {
        maLine.moveTo(x, y);
      } else {
        maLine.lineTo(x, y);
      }
    }
  }

  return { layer, render };
}
