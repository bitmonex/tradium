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
      color: 0xffcc00,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period    = params.period ?? bbw.meta.defaultParams.period;
    const mult      = params.mult   ?? bbw.meta.defaultParams.mult;
    const color     = params.color  ?? bbw.meta.defaultParams.color;
    const lineWidth = params.lineWidth ?? bbw.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const line = new PIXI.Graphics();
    layer.sortableChildren = true;
    line.zIndex = 10;
    layer.addChild(line);

    let values = [];
    let hoverIdx = null;

    // SMA helper
    function sma(arr, p) {
      const out = Array(arr.length).fill(null);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= p) sum -= arr[i - p];
        if (i >= p - 1) out[i] = sum / p;
      }
      return out;
    }

    // StdDev helper
    function stddev(arr, p) {
      const out = Array(arr.length).fill(null);
      for (let i = 0; i < arr.length; i++) {
        if (i < p - 1) continue;
        const slice = arr.slice(i - p + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / p;
        const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / p;
        out[i] = Math.sqrt(variance);
      }
      return out;
    }

    // BBW calculation
    function calculate(candles) {
      if (!candles || candles.length < period) {
        values = Array(candles?.length || 0).fill(null);
        return values;
      }

      const closes = candles.map(c => c.close);
      const smaVals = sma(closes, period);
      const stdVals = stddev(closes, period);

      values = closes.map((_, i) => {
        if (smaVals[i] == null || stdVals[i] == null) return null;
        const upper = smaVals[i] + mult * stdVals[i];
        const lower = smaVals[i] - mult * stdVals[i];
        return (upper - lower) / smaVals[i] * 100;
      });

      return values;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      line.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('bbw');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, values.length, 2);

      const maxVal = Math.max(...values.filter(v => v != null)) || 1;

      let started = false;
      line.beginPath();
      for (let i = start; i <= end; i++) {
        const val = values[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = plotH * (1 - (val / maxVal) * scaleY);
        if (!started) { line.moveTo(x, y); started = true; }
        else line.lineTo(x, y);
      }
      if (started) line.stroke({ width: lineWidth, color });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('bbw', `${period} ${mult}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const lastIdx = values.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : values[lastIdx];
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

    return { render, updateHover, calculate, values };
  }
};
