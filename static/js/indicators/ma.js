// indicators/ma.js
export const ma = {
  meta: {
    id: 'ma',
    name: 'Moving Average',
    position: 'top',       // слой поверх графика
    zIndex: 60,
    period: 50,
    color: 0xffd700
  },

  createIndicator({ layer, chartCore }, layout, params = {}) {
    const period = params.period || ma.meta.period;
    const color = params.color || ma.meta.color;

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

    let maValues = [];

    function render(currentLayout) {
      const candles = currentLayout.candles;
      if (!candles?.length) return;

      // Пересчитываем всегда, чтобы линия тянулась при скролле/зуме
      maValues = calculateMA(candles, period);

      maLine.clear();

      const cw = (currentLayout.config.candleWidth + currentLayout.config.spacing) * currentLayout.scaleX;
      const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || 1;

      let started = false;

      for (let i = 0; i < maValues.length; i++) {
        const val = maValues[i];
        if (val === null) continue;

        const x = i * cw + currentLayout.offsetX;
        const y = (currentLayout.plotH * (1 - (val - minPrice) / priceRange)) * currentLayout.scaleY + currentLayout.offsetY;

        if (!started) {
          maLine.moveTo(x, y);
          started = true;
        } else {
          maLine.lineTo(x, y);
        }
      }

      maLine.stroke({ width: 2, color });
    }

    return { render };
  }
};
