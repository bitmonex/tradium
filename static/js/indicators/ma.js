// indicators/ma.js
export const ma = {
  meta: {
    id: 'ma',
    name: 'MA50 & MA200',
    position: 'top',
    zIndex: 9999,
    // 🔹 параметры вынесены в meta
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

    function render(layout) {
      if (!layout?.candles?.length) return;

      const { candles, indexToX, priceToY } = layout;
      const { periods, colors, widths } = ma.meta;

      const maFast = calcMA(candles, periods.fast);
      const maSlow = calcMA(candles, periods.slow);

      g.clear();

      // 🔹 MA50 (зелёная)
      let started = false;
      for (let i = 0; i < candles.length; i++) {
        const val = maFast[i];
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
      if (started) g.stroke({ width: widths.fast, color: colors.fast });

      // 🔹 MA200 (красная)
      started = false;
      for (let i = 0; i < candles.length; i++) {
        const val = maSlow[i];
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
      if (started) g.stroke({ width: widths.slow, color: colors.slow });

      //console.log(`[MA] rendered: candles=${candles.length}, MA50+MA200`);
    }

    return { render };
  }
};
