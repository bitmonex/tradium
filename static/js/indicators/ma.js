// indicators/ma.js
export const ma = {
  meta: {
    id: 'ma',
    name: 'Moving Average',
    position: 'top',
    zIndex: 60
  },

  createIndicator({ layer, chartCore }, layout, params = {}) {
    const periods = params.periods ?? [50, 200];
    const colors  = params.colors  ?? [0x00ff00, 0xff0000, 0x333333];

    const lines = periods.map(() => new PIXI.Graphics());
    lines.forEach(line => layer.addChild(line));

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

    function render(currentLayout) {
      const candles = currentLayout.candles;
      if (!candles?.length) return;

      const cw = (currentLayout.config.candleWidth + currentLayout.config.spacing) * currentLayout.scaleX;
      const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || 1;

      lines.forEach((line, idx) => {
        const period = periods[idx];
        const color  = colors[idx];
        if (!period || !color) {
          line.clear();
          return;
        }

        const maValues = calculateMA(candles, period);
        line.clear();

        let started = false;
        for (let i = 0; i < maValues.length; i++) {
          const val = maValues[i];
          if (val === null) continue;

          const x = i * cw + currentLayout.offsetX;
          const y = (currentLayout.plotH * (1 - (val - minPrice) / priceRange)) * currentLayout.scaleY + currentLayout.offsetY;

          if (!started) {
            line.moveTo(x, y);
            started = true;
          } else {
            line.lineTo(x, y);
          }
        }

        line.stroke({ width: 2, color });
      });
    }

    return { render };
  }
};
