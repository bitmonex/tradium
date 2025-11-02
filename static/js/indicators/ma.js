// indicators/ma.js
export const ma = {
  meta: {
    id: 'ma',
    name: 'MA50 & MA200',
    position: 'top',
    zIndex: 9999,
    periods: {
      fast: 50,
      slow: 200
    },
    colors: {
      fast: 0x00ff00, // зелёный
      slow: 0xff0000  // красный
    },
    widths: {
      fast: 2.5,
      slow: 2.5
    }
  },

  createIndicator({ layer }) {
    const g = new PIXI.Graphics();
    g.zIndex = 9999;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    function calcMA(candles, period) {
      const out = [];
      let sum = 0;
      for (let i = 0; i < candles.length; i++) {
        sum += candles[i].close;
        if (i >= period) sum -= candles[i - period].close;
        out.push(i >= period - 1 ? sum / period : null);
      }
      return out;
    }

    function renderLine(values, color, width, indexToX, priceToY, step) {
      let started = false;
      for (let i = 0; i < values.length; i += step) {
        const val = values[i];
        if (val == null) continue;
        const x = indexToX(i);
        const y = priceToY(val);
        if (!started) {
          g.moveTo(x, y);
          started = true;
        } else {
          g.lineTo(x, y);
        }
      }
      if (started) g.stroke({ width, color });
    }

    function render(layout) {
      if (!layout?.candles?.length) return;

      const { candles, indexToX, priceToY, plotW, candleWidth, scaleX } = layout;
      const { periods, colors, widths } = ma.meta;

      const maFast = calcMA(candles, periods.fast);
      const maSlow = calcMA(candles, periods.slow);

      g.clear();

      // --- LOD: шаг прореживания
      const barWidth = candleWidth * scaleX;
      const barsOnScreen = plotW / Math.max(1, barWidth);
      let step = 1;
      if (barsOnScreen > 3000) step = 10;
      else if (barsOnScreen > 1500) step = 5;
      else if (barsOnScreen > 800) step = 2;

      // 🔹 MA50 (зелёная)
      renderLine(maFast, colors.fast, widths.fast, indexToX, priceToY, step);

      // 🔹 MA200 (красная)
      renderLine(maSlow, colors.slow, widths.slow, indexToX, priceToY, step);
    }

    return { render };
  }
};
