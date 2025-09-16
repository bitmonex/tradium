//Indicator MA
export function createIndicator({ layer }, layout, params = {}) {
  if (!layer || !layout?.candles?.length) return;

  const maLayer = new PIXI.Container();
  layer.addChild(maLayer);

  const period = params.period || 14;
  const maLine = new PIXI.Graphics();
  maLayer.addChild(maLine);

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

  let maValues = [];

  function render(currentLayout) {
    const candles = currentLayout.candles;
    if (!candles?.length) return;

    if (maValues.length !== candles.length) {
      maValues = calculateMA(candles, period);
    }

    maLine.clear();

    const cw = currentLayout.config.candleWidth + currentLayout.config.spacing;
    const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    let started = false;

    for (let i = 0; i < maValues.length; i++) {
      const val = maValues[i];
      if (val === null) continue;

      const x = i * cw * currentLayout.scaleX + currentLayout.offsetX;
      const y = ((currentLayout.height - currentLayout.config.bottomOffset) *
                (1 - (val - minPrice) / priceRange)) *
                currentLayout.scaleY + currentLayout.offsetY;

      if (!started) {
        maLine.moveTo(x, y);
        started = true;
      } else {
        maLine.lineTo(x, y);
      }
    }

    // один вызов stroke в конце
    maLine.stroke({ width: 2, color: 0xffd700 });
  }

  return { layer: maLayer, render };
}
