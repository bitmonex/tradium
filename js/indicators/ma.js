export const ma = {
  meta: {
    id: 'ma',
    name: 'Moving Average',
    position: 'top',
    zIndex: 60
  },

  createIndicator({ layer }, layout, params = {}) {
    const periods = params.periods ?? [50, 200];
    const colors  = params.colors  ?? [0x00ff00, 0xff0000, 0x333333];

    let lines = [];

    function calculateMA(data, period) {
      const result = Array(period - 1).fill(null);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period) sum -= data[i - period].close;
        if (i >= period - 1) result.push(sum / period);
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

      // Удаляем старые линии
      lines.forEach(line => {
        layer.removeChild(line);
        line.destroy({ children: true });
      });

      lines = periods.map(() => new PIXI.Graphics());
      lines.forEach(line => layer.addChild(line));

      lines.forEach((line, idx) => {
        const period = periods[idx];
        const color  = colors[idx];
        if (!period || !color) return;

        const maValues = calculateMA(candles, period);

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

        line.stroke({ width: 1.5, color });
      });
    }

    return { render };
  }
};
