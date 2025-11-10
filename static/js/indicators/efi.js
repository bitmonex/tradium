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
      color: 0x00ff00,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period    = params.period ?? efi.meta.defaultParams.period;
    const color     = params.color  ?? efi.meta.defaultParams.color;
    const lineWidth = params.lineWidth ?? efi.meta.defaultParams.lineWidth;

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
    function ema(arr, p) {
      if (!arr?.length) return [];
      const out = Array(arr.length).fill(null);
      const k = 2 / (p + 1);
      let emaPrev = arr[0];
      out[0] = emaPrev;
      for (let i = 1; i < arr.length; i++) {
        emaPrev = arr[i] * k + emaPrev * (1 - k);
        out[i] = emaPrev;
      }
      return out;
    }

    // EFI calculation
    function calculate(candles) {
      if (!candles || candles.length < 2) {
        values = Array(candles?.length || 0).fill(null);
        return values;
      }

      const raw = Array(candles.length).fill(null);
      for (let i = 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        const vol  = candles[i].volume ?? 0;
        raw[i] = diff * vol;
      }

      values = ema(raw, period);
      return values;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      line.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('efi');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, values.length, 2);

      const maxAbs = Math.max(...values.map(v => Math.abs(v) || 0)) || 1;

      let started = false;
      line.beginPath();
      for (let i = start; i <= end; i++) {
        const val = values[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = plotH / 2 - (val / maxAbs) * (plotH / 2) * scaleY;
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
        overlay.updateParam('efi', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const lastIdx = values.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : values[lastIdx];
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

    return { render, updateHover, calculate, values };
  }
};

