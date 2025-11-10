// indicators/ma.js
export const ma = {
  meta: {
    id: 'ma',
    name: 'MA50 & MA200',
    position: 'top',
    zIndex: 9999,
    defaultParams: {
      fastPeriod: 50,
      slowPeriod: 200,
      fastColor: 0x00ff00, // зелёный
      slowColor: 0xff0000, // красный
      fastWidth: 2,
      slowWidth: 2
    }
  },

  createIndicator({ layer, chartCore }, layout, params = {}) {
    const fastPeriod = params.fastPeriod ?? ma.meta.defaultParams.fastPeriod;
    const slowPeriod = params.slowPeriod ?? ma.meta.defaultParams.slowPeriod;
    const fastColor  = params.fastColor  ?? ma.meta.defaultParams.fastColor;
    const slowColor  = params.slowColor  ?? ma.meta.defaultParams.slowColor;
    const fastWidth  = params.fastWidth  ?? ma.meta.defaultParams.fastWidth;
    const slowWidth  = params.slowWidth  ?? ma.meta.defaultParams.slowWidth;

    const g = new PIXI.Graphics();
    g.zIndex = ma.meta.zIndex;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    function calcMA(candles, period) {
      if (!Array.isArray(candles) || !candles.length) return [];
      const out = Array(candles.length).fill(null);
      let sum = 0;
      for (let i = 0; i < candles.length; i++) {
        sum += candles[i].close;
        if (i >= period) sum -= candles[i - period].close;
        if (i >= period - 1) out[i] = sum / period;
      }
      return out;
    }

    function renderLine(values, color, width, indexToX, priceToY, step) {
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

    function render(layout) {
      if (!layout?.candles?.length) return;

      const { candles, indexToX, priceToY, plotW, candleWidth, scaleX } = layout;

      const maFast = calcMA(candles, fastPeriod);
      const maSlow = calcMA(candles, slowPeriod);

      g.clear();

      // --- LOD: шаг прореживания
      const barWidth = candleWidth * scaleX;
      const barsOnScreen = plotW / Math.max(1, barWidth);
      let step = 1;
      if (barsOnScreen > 3000) step = 10;
      else if (barsOnScreen > 1500) step = 5;
      else if (barsOnScreen > 800) step = 2;

      // 🔹 MA50 (зелёная)
      renderLine(maFast, fastColor, fastWidth, indexToX, priceToY, step);

      // 🔹 MA200 (красная)
      renderLine(maSlow, slowColor, slowWidth, indexToX, priceToY, step);
    }

    return { render };
  }
};
