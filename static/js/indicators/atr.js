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
      fillColor: 0x090909
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const period    = params.period    ?? atr.meta.defaultParams.period;
    const color     = params.color     ?? atr.meta.defaultParams.color;
    const fillColor = params.fillColor ?? atr.meta.defaultParams.fillColor;

    const line     = new PIXI.Graphics();
    const fillArea = new PIXI.Graphics();

    layer.sortableChildren = true;
    fillArea.zIndex = 0;
    line.zIndex     = 10;

    layer.addChild(fillArea, line);

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
    function calculateATR(data, p) {
      if (!data || data.length < p + 1) return Array(data?.length || 0).fill(null);

      const trs = [];
      for (let i = 0; i < data.length; i++) {
        const tr = trueRange(data[i], data[i - 1]);
        trs.push(tr);
      }

      const result = [];
      let sum = 0;
      for (let i = 0; i < trs.length; i++) {
        sum += trs[i];
        if (i >= p) sum -= trs[i - p];
        result.push(i >= p ? sum / p : null);
      }
      return result;
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculateATR(candles, period);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();
      fillArea.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // фон
      fillArea.beginFill(fillColor);
      fillArea.drawRect(0, 0, plotW, plotH);
      fillArea.endFill();

      // линия ATR
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
        line.stroke({ width: 2, color });
      }

      // overlay
      if (overlay?.updateParam) {
        overlay.updateParam('atr', `${period}`);
      }
      if (overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('atr', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!overlay?.updateValue || !values?.length) return;
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

    return { render, updateHover };
  }
};
