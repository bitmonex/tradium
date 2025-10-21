// indicators/efi.js
export const efi = {
  meta: {
    id: 'efi',
    name: 'Elder Force Index',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 13,
      color: 0x00ff00
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period = params.period ?? efi.meta.defaultParams.period;
    const color  = params.color  ?? efi.meta.defaultParams.color;

    const showPar = true;
    const showVal = true;

    const line     = new PIXI.Graphics();
    const zeroLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    zeroLine.zIndex = 5;
    line.zIndex     = 10;

    layer.addChild(zeroLine, line);

    let values = [];
    let hoverIdx = null;

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

    // EFI calculation
    function calculate(data, p) {
      if (!data || data.length < 2) return Array(data?.length || 0).fill(null);

      const raw = [];
      for (let i = 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const vol  = data[i].volume ?? 0;
        raw.push(diff * vol);
      }

      const smoothed = ema(raw, p);
      return [null].concat(smoothed); // выравниваем длину
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculate(candles, period);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // 🔹 берём scaleY из менеджера индикаторов
      const obj = chartCore?.indicators?.get('efi');
      const scaleY = obj?.scaleY ?? 1;

      // линия EFI
      let started = false;
      line.beginPath();
      const maxAbs = Math.max(...values.map(v => Math.abs(v) || 0)) || 1;
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;

        // применяем scaleY
        const y = plotH / 2 - (val / maxAbs) * (plotH / 2) * scaleY;
        if (!started) { line.moveTo(x, y); started = true; }
        else line.lineTo(x, y);
      }
      if (started) line.stroke({ width: 2, color });

      // центральная линия (ноль)
      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x555555 });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('efi', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('efi', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('efi', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('efi', v != null ? v.toFixed(2) : '');
    }

    return { render, updateHover };
  }
};
