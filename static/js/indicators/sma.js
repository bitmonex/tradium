// indicators/sma.js
export const sma = {
  meta: {
    id: 'sma',
    name: 'SMA25',
    position: 'top',
    zIndex: 9999,
    period: 25,
    color: 0xffa500, // оранжевый
    width: 1.25
  },

  createIndicator({ layer }) {
    const g = new PIXI.Graphics();
    g.zIndex = 9999;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    function calcSMA(candles, period) {
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
      const { period, color, width } = sma.meta;

      const values = calcSMA(candles, period);

      g.clear();

      // --- LOD: шаг прореживания
      const barWidth = candleWidth * scaleX;
      const barsOnScreen = plotW / Math.max(1, barWidth);
      let step = 1;
      if (barsOnScreen > 3000) step = 10;
      else if (barsOnScreen > 1500) step = 5;
      else if (barsOnScreen > 800) step = 2;

      // 🔹 SMA25 (оранжевая)
      renderLine(values, color, width, indexToX, priceToY, step);

      //console.log(`[SMA${period}] rendered: candles=${candles.length}, step=${step}`);
    }

    return { render };
  }
};
