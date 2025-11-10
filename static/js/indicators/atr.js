// indicators/atr.js
export const atr = {
  meta: {
    id: 'atr',
    name: 'ATR',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 14,
      color: 0xff0000,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period    = params.period ?? atr.meta.defaultParams.period;
    const color     = params.color  ?? atr.meta.defaultParams.color;
    const lineWidth = params.lineWidth ?? atr.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const line = new PIXI.Graphics();
    layer.sortableChildren = true;
    line.zIndex = 10;
    layer.addChild(line);

    let values = [];
    let hoverIdx = null;

    // True Range
    function trueRange(curr, prev) {
      if (!prev) return curr.high - curr.low;
      return Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
    }

    // ATR calculation
    function calculate(candles) {
      if (!candles || candles.length < period + 1) {
        values = Array(candles?.length || 0).fill(null);
        return values;
      }

      const trs = candles.map((c, i) => trueRange(c, candles[i - 1]));
      const out = Array(trs.length).fill(null);
      let sum = 0;
      for (let i = 0; i < trs.length; i++) {
        sum += trs[i];
        if (i >= period) sum -= trs[i - period];
        if (i >= period) out[i] = sum / period;
      }
      values = out;
      return values;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      line.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('atr');
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
        overlay.updateParam('atr', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const lastIdx = values.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : values[lastIdx];
        overlay.updateValue('atr', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('atr', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('atr', v != null ? v.toFixed(2) : '');
    }

    return { render, updateHover, calculate, values };
  }
};
