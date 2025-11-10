// indicators/sma.js
export const sma = {
  meta: {
    id: 'sma',
    name: 'SMA',
    position: 'top',
    zIndex: 9999,
    defaultParams: {
      period: 25,
      color: 0xffa500,
      width: 1.25
    }
  },

  createIndicator({ layer, chartCore }, layout, params = {}) {
    const period = params.period ?? sma.meta.defaultParams.period;
    const color  = params.color  ?? sma.meta.defaultParams.color;
    const width  = params.width  ?? sma.meta.defaultParams.width;

    const g = new PIXI.Graphics();
    g.zIndex = sma.meta.zIndex;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    let values = [];

    function calcSMA(candles, period) {
      const out = Array(candles.length).fill(null);
      let sum = 0;
      for (let i = 0; i < candles.length; i++) {
        sum += candles[i].close;
        if (i >= period) sum -= candles[i - period].close;
        if (i >= period - 1) out[i] = sum / period;
      }
      return out;
    }

    function render(layout) {
      const { indexToX, priceToY, plotW, candleWidth, scaleX } = layout;
      if (!values?.length) return;

      g.clear();

      const barWidth = candleWidth * scaleX;
      const barsOnScreen = plotW / Math.max(1, barWidth);
      let step = 1;
      if (barsOnScreen > 3000) step = 10;
      else if (barsOnScreen > 1500) step = 5;
      else if (barsOnScreen > 800) step = 2;

      let started = false;
      g.beginPath();
      for (let i = 0; i < values.length; i += step) {
        const val = values[i];
        if (val == null) continue;
        const x = indexToX(i);
        const y = priceToY(val);
        if (!started) { g.moveTo(x, y); started = true; }
        else { g.lineTo(x, y); }
      }
      if (started) g.stroke({ width, color });
    }

    return {
      render,
      calculate: (candles) => {
        values = calcSMA(candles, period);
        return values;
      },
      values
    };
  }
};
