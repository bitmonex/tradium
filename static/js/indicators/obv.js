// indicators/obv.js
export const obv = {
  meta: {
    id: 'obv',
    name: 'On-Balance Volume',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      smoothType: 'sma',   // 'sma' или 'ema'
      smoothLength: 9,
      colorRaw: 0x41AB00,    // основная OBV
      colorSmooth: 0x0284CF  // сглаженная линия
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const smoothType   = params.smoothType   ?? obv.meta.defaultParams.smoothType;
    const smoothLength = params.smoothLength ?? obv.meta.defaultParams.smoothLength;
    const colorRaw     = params.colorRaw     ?? obv.meta.defaultParams.colorRaw;
    const colorSmooth  = params.colorSmooth  ?? obv.meta.defaultParams.colorSmooth;

    const showPar = true;
    const showVal = true;

    const rawLine    = new PIXI.Graphics();
    const smoothLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    rawLine.zIndex    = 10;
    smoothLine.zIndex = 11;

    layer.addChild(rawLine, smoothLine);

    let rawValues = [];
    let smoothValues = [];
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

    // EMA helper
    function ema(values, p) {
      const k = 2 / (p + 1);
      let emaPrev = values[0];
      const result = [emaPrev];
      for (let i = 1; i < values.length; i++) {
        emaPrev = values[i] * k + emaPrev * (1 - k);
        result.push(emaPrev);
      }
      return result;
    }

    // OBV calculation (raw)
    function calculateOBV(data) {
      if (!data || data.length < 2) return Array(data?.length || 0).fill(null);

      const obvVals = [0];
      for (let i = 1; i < data.length; i++) {
        const prevClose = data[i - 1].close;
        const currClose = data[i].close;
        const vol = data[i].volume ?? 0;

        if (currClose > prevClose) obvVals.push(obvVals[i - 1] + vol);
        else if (currClose < prevClose) obvVals.push(obvVals[i - 1] - vol);
        else obvVals.push(obvVals[i - 1]);
      }
      return obvVals;
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      rawValues = calculateOBV(candles);

      // сглаживание
      if (smoothLength > 1) {
        smoothValues = (smoothType === 'ema')
          ? ema(rawValues, smoothLength)
          : sma(rawValues, smoothLength);
      } else {
        smoothValues = [];
      }

      const lastIdx = rawValues.length - 1;
      const lastRaw = rawValues[lastIdx];
      const lastSmooth = smoothValues.length ? smoothValues[lastIdx] : null;

      rawLine.clear();
      smoothLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // 🔹 берём scaleY из менеджера индикаторов
      const obj = chartCore?.indicators?.get('obv');
      const scaleY = obj?.scaleY ?? 1;

      // нормализация
      const allVals = [...rawValues, ...smoothValues].filter(v => v != null);
      const minVal = Math.min(...allVals);
      const maxVal = Math.max(...allVals);
      const range = maxVal - minVal || 1;

      // --- Raw OBV ---
      let started = false;
      rawLine.beginPath();
      for (let i = 0; i < rawValues.length; i++) {
        const val = rawValues[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;
        // применяем scaleY
        const y = plotH * (1 - ((val - minVal) / range) * scaleY);
        if (!started) { rawLine.moveTo(x, y); started = true; }
        else rawLine.lineTo(x, y);
      }
      if (started) rawLine.stroke({ width: 2, color: colorRaw });

      // --- Smooth OBV ---
      if (smoothValues.length) {
        started = false;
        smoothLine.beginPath();
        for (let i = 0; i < smoothValues.length; i++) {
          const val = smoothValues[i];
          if (val == null) continue;
          const x = localLayout.indexToX(i);
          if (x < 0) continue;
          if (x > plotW) break;
          // применяем scaleY
          const y = plotH * (1 - ((val - minVal) / range) * scaleY);
          if (!started) { smoothLine.moveTo(x, y); started = true; }
          else smoothLine.lineTo(x, y);
        }
        if (started) smoothLine.stroke({ width: 2, color: colorSmooth });
      }

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('obv', `${smoothType.toUpperCase()} ${smoothLength}`);
      }
      if (showVal && overlay?.updateValue && rawValues.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const valRaw = isHoverLocked ? rawValues[hoverIdx] : lastRaw;
        const valSmooth = isHoverLocked ? smoothValues[hoverIdx] : lastSmooth;
        overlay.updateValue(
          'obv',
          (valRaw != null ? valRaw.toFixed(0) : '') +
          (valSmooth != null ? ' / ' + valSmooth.toFixed(0) : '')
        );
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !rawValues?.length) return;
      const lastIdx = rawValues.length - 1;

      if (idx == null || idx < 0 || idx >= rawValues.length) {
        hoverIdx = null;
        const autoRaw = rawValues[lastIdx];
        const autoSmooth = smoothValues[lastIdx];
        overlay.updateValue(
          'obv',
          (autoRaw != null ? autoRaw.toFixed(0) : '') +
          (autoSmooth != null ? ' / ' + autoSmooth.toFixed(0) : '')
        );
        return;
      }

      hoverIdx = idx;
      const vRaw = rawValues[idx];
      const vSmooth = smoothValues[idx];
      overlay.updateValue(
        'obv',
        (vRaw != null ? vRaw.toFixed(0) : '') +
        (vSmooth != null ? ' / ' + vSmooth.toFixed(0) : '')
      );
    }

    return { render, updateHover };
  }
};
