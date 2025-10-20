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
      fillColor: 0x090909,
      levels: [0],
      levelColors: [0x888888]
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const period      = params.period      ?? cfm.meta.defaultParams.period;
    const color       = params.color       ?? cfm.meta.defaultParams.color;
    const fillColor   = params.fillColor   ?? cfm.meta.defaultParams.fillColor;
    const levels      = params.levels      ?? cfm.meta.defaultParams.levels;
    const levelColors = params.levelColors ?? cfm.meta.defaultParams.levelColors;

    const showPar = true;
    const showVal = true;

    const line      = new PIXI.Graphics();
    const levelLine = new PIXI.Graphics();
    const fillArea  = new PIXI.Graphics();

    layer.sortableChildren = true;
    fillArea.zIndex  = 0;
    levelLine.zIndex = 5;
    line.zIndex      = 10;

    layer.addChild(fillArea, levelLine, line);

    let values = [];
    let hoverIdx = null;

    // CMF calculation
    function calculate(data, p) {
      if (!data || data.length < p) return Array(data?.length || 0).fill(null);

      const result = [];
      for (let i = 0; i < data.length; i++) {
        if (i < p - 1) {
          result.push(null);
          continue;
        }

        let sumMFV = 0;
        let sumVol = 0;
        for (let j = i - p + 1; j <= i; j++) {
          const c = data[j];
          const prev = data[j - 1];
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
      return result;
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculate(candles, period);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();
      levelLine.clear();
      fillArea.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // фон
      fillArea.beginFill(fillColor);
      fillArea.drawRect(0, 0, plotW, plotH);
      fillArea.endFill();

      // линия CMF
      let started = false;
      line.beginPath();
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;

        const y = plotH / 2 - val * (plotH / 2);
        if (!started) { line.moveTo(x, y); started = true; }
        else { line.lineTo(x, y); }
      }
      if (started) line.stroke({ width: 2, color });

      // уровни (ноль)
      levels.forEach((level, idx) => {
        const y = plotH / 2 - level * (plotH / 2);
        const lineColor = levelColors[idx] ?? 0xffffff;
        levelLine.moveTo(0, y);
        levelLine.lineTo(plotW, y);
        levelLine.stroke({ width: 1, color: lineColor });
      });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('cfm', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
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

    return { render, updateHover };
  }
};
