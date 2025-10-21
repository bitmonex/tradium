// indicators/bbw.js
export const bbw = {
  meta: {
    id: 'bbw',
    name: 'Bollinger Band Width',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 20,
      mult: 2,
      color: 0xffcc00
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const period = params.period ?? bbw.meta.defaultParams.period;
    const mult   = params.mult   ?? bbw.meta.defaultParams.mult;
    const color  = params.color  ?? bbw.meta.defaultParams.color;

    const showPar = true;
    const showVal = true;

    const line = new PIXI.Graphics();

    layer.sortableChildren = true;
    line.zIndex = 10;

    layer.addChild(line);

    let values = [];
    let hoverIdx = null;

    // SMA helper
    function sma(values, p) {
      const result = [];
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= p) sum -= values[i - p];
        result.push(i >= p - 1 ? sum / p : null);
      }
      return result;
    }

    // StdDev helper
    function stddev(values, p) {
      const result = [];
      for (let i = 0; i < values.length; i++) {
        if (i < p - 1) {
          result.push(null);
          continue;
        }
        const slice = values.slice(i - p + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / p;
        const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / p;
        result.push(Math.sqrt(variance));
      }
      return result;
    }

    // BBW calculation
    function calculate(data, p, k) {
      if (!data || data.length < p) return Array(data?.length || 0).fill(null);

      const closes = data.map(c => c.close);
      const smaVals = sma(closes, p);
      const stdVals = stddev(closes, p);

      return closes.map((_, i) => {
        if (smaVals[i] == null || stdVals[i] == null) return null;
        const upper = smaVals[i] + k * stdVals[i];
        const lower = smaVals[i] - k * stdVals[i];
        return (upper - lower) / smaVals[i] * 100;
      });
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculate(candles, period, mult);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // линия BBW
      let started = false;
      line.beginPath();
      const maxVal = Math.max(...values.filter(v => v != null));
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;

        const y = plotH * (1 - val / maxVal);
        if (!started) { line.moveTo(x, y); started = true; }
        else { line.lineTo(x, y); }
      }
      if (started) {
        line.stroke({ width: 2, color }); // 🔹 толщина 2
      }

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('bbw', `${period} ${mult}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('bbw', val != null ? val.toFixed(2) + '%' : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('bbw', autoVal != null ? autoVal.toFixed(2) + '%' : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('bbw', v != null ? v.toFixed(2) + '%' : '');
    }

    return { render, updateHover };
  }
};
