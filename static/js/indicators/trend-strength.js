// indicators/trend-strength.js
export const trendStrength = {
  meta: {
    id: 'trendStrength',
    name: 'Trend Strength Index',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 14,
      color: 0xffcc00,
      levels: [0], // уровень нуля
      levelColors: [0x333333],
      fillColor: 0x090909
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const period      = params.period      ?? trendStrength.meta.defaultParams.period;
    const color       = params.color       ?? trendStrength.meta.defaultParams.color;
    const levels      = params.levels      ?? trendStrength.meta.defaultParams.levels;
    const levelColors = params.levelColors ?? trendStrength.meta.defaultParams.levelColors;
    const fillColor   = params.fillColor   ?? trendStrength.meta.defaultParams.fillColor;

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

    // EMA helper
    function ema(values, period) {
      const k = 2 / (period + 1);
      let emaPrev = values[0];
      const result = [emaPrev];
      for (let i = 1; i < values.length; i++) {
        emaPrev = values[i] * k + emaPrev * (1 - k);
        result.push(emaPrev);
      }
      return result;
    }

    // Trend Strength calculation (двойное сглаживание)
    function calculate(data, period) {
      if (!data || data.length < period + 2) return Array(data?.length || 0).fill(null);

      const momentum = [];
      for (let i = 1; i < data.length; i++) {
        momentum.push(data[i].close - data[i - 1].close);
      }
      const absMomentum = momentum.map(v => Math.abs(v));

      const emaMom1 = ema(momentum, period);
      const emaMom2 = ema(emaMom1, period);

      const emaAbs1 = ema(absMomentum, period);
      const emaAbs2 = ema(emaAbs1, period);

      const tsiVals = emaMom2.map((v, i) => (emaAbs2[i] ? (100 * v) / emaAbs2[i] : 0));

      // выравниваем длину под количество свечей
      return Array(1).fill(null).concat(tsiVals);
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

      // линия индикатора
      let started = false;
      line.beginPath();
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;

        const y = plotH / 2 - (val / 100) * (plotH / 2);
        if (!started) { line.moveTo(x, y); started = true; }
        else { line.lineTo(x, y); }
      }
      if (started) {
        line.stroke({ width: 2, color });
      }

      // уровни (например, нулевая линия)
      levels.forEach((level, idx) => {
        const y = plotH / 2 - (level / 100) * (plotH / 2);
        const lineColor = levelColors[idx] ?? 0xffffff;
        levelLine.moveTo(0, y);
        levelLine.lineTo(plotW, y);
        levelLine.stroke({ width: 1, color: lineColor });
      });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('trendStrength', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('trendStrength', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('trendStrength', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('trendStrength', v != null ? v.toFixed(2) : '');
    }

    return { render, updateHover };
  }
};
