// indicators/volatility-ohlc.js
export const volatilityOHLC = {
  meta: {
    id: 'volatilityOHLC',
    name: 'Volatility OHLC',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 10,
      color: 0x00ff00
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period = params.period ?? volatilityOHLC.meta.defaultParams.period;
    const color  = params.color  ?? volatilityOHLC.meta.defaultParams.color;

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

    // Volatility calculation
    function calculate(data, p) {
      if (!data || data.length < p) return Array(data?.length || 0).fill(null);

      const vols = [];
      for (let i = 1; i < data.length; i++) {
        const v = ((data[i].high - data[i].low) / data[i - 1].close) * 100;
        vols.push(v);
      }
      const smoothed = sma(vols, p);
      return [null].concat(smoothed); // выравниваем длину
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculate(candles, period);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // 🔹 берём scaleY из менеджера индикаторов
      const obj = chartCore?.indicators?.get('volatilityOHLC');
      const scaleY = obj?.scaleY ?? 1;

      // --- определяем видимый диапазон + буфер ---
      let firstIdx = 0;
      let lastVisibleIdx = values.length - 1;
      for (let i = 0; i < values.length; i++) {
        const x = localLayout.indexToX(i);
        if (x >= 0) { firstIdx = Math.max(0, i - 2); break; }
      }
      for (let i = values.length - 1; i >= 0; i--) {
        const x = localLayout.indexToX(i);
        if (x <= plotW) { lastVisibleIdx = Math.min(values.length - 1, i + 2); break; }
      }

      // линия волатильности
      let started = false;
      line.beginPath();
      const maxVal = Math.max(...values.filter(v => v != null));
      for (let i = firstIdx; i <= lastVisibleIdx; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        const y = plotH * (1 - (val / maxVal) * scaleY);
        if (!started) { line.moveTo(x, y); started = true; }
        else { line.lineTo(x, y); }
      }
      if (started) {
        line.stroke({ width: 2, color });
      }

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('volatilityOHLC', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('volatilityOHLC', val != null ? val.toFixed(2) + '%' : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('volatilityOHLC', autoVal != null ? autoVal.toFixed(2) + '%' : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('volatilityOHLC', v != null ? v.toFixed(2) + '%' : '');
    }

    return { render, updateHover };
  }
};
