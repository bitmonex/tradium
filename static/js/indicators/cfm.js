// indicators/cmf.js
export const cfm = {
  meta: {
    id: 'cfm',
    name: 'Chaikin Money Flow',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 20,
      color: 0x00ff00,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period    = params.period ?? cfm.meta.defaultParams.period;
    const color     = params.color  ?? cfm.meta.defaultParams.color;
    const lineWidth = params.lineWidth ?? cfm.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const line     = new PIXI.Graphics();
    const zeroLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    zeroLine.zIndex  = 5;
    line.zIndex      = 10;
    layer.addChild(zeroLine, line);

    let values = [];
    let hoverIdx = null;

    // CMF calculation
    function calculate(candles) {
      if (!candles || candles.length < period) {
        values = Array(candles?.length || 0).fill(null);
        return values;
      }

      const result = [];
      for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
          result.push(null);
          continue;
        }

        let sumMFV = 0;
        let sumVol = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const c = candles[j];
          const high = c.high;
          const low = c.low;
          const close = c.close;
          const vol = c.volume ?? 0;

          const mfm = (high !== low)
            ? ((close - low) - (high - close)) / (high - low)
            : 0;
          const mfv = mfm * vol;

          sumMFV += mfv;
          sumVol += vol;
        }
        result.push(sumVol !== 0 ? sumMFV / sumVol : 0);
      }
      values = result;
      return values;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      line.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('cfm');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, values.length, 2);

      let started = false;
      line.beginPath();
      for (let i = start; i <= end; i++) {
        const val = values[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = plotH / 2 - val * (plotH / 2) * scaleY;
        if (!started) { line.moveTo(x, y); started = true; }
        else line.lineTo(x, y);
      }
      if (started) line.stroke({ width: lineWidth, color });

      // центральная линия (ноль)
      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x555555 });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('cfm', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const lastIdx = values.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : values[lastIdx];
        overlay.updateValue('cfm', val != null ? val.toFixed(4) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('cfm', autoVal != null ? autoVal.toFixed(4) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('cfm', v != null ? v.toFixed(4) : '');
    }

    return { render, updateHover, calculate, values };
  }
};
