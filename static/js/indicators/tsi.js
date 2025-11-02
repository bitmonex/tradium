// indicators/tsi.js
export const tsi = {
  meta: {
    id: 'tsi',
    name: 'True Strength Index',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      long: 25,
      short: 13,
      signal: 13,
      colorTSI: 0x2196f3,   // основная линия
      colorSignal: 0xe91e63 // сигнальная линия
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const long        = params.long        ?? tsi.meta.defaultParams.long;
    const short       = params.short       ?? tsi.meta.defaultParams.short;
    const signal      = params.signal      ?? tsi.meta.defaultParams.signal;
    const colorTSI    = params.colorTSI    ?? tsi.meta.defaultParams.colorTSI;
    const colorSignal = params.colorSignal ?? tsi.meta.defaultParams.colorSignal;

    const showPar = true;
    const showVal = true;

    const tsiLine    = new PIXI.Graphics();
    const signalLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    tsiLine.zIndex    = 10;
    signalLine.zIndex = 11;

    layer.addChild(tsiLine, signalLine);

    let tsiVals = [];
    let signalVals = [];
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

    // TSI calculation
    function calculateTSI(data, longP, shortP, signalP) {
      if (!data || data.length < longP + shortP) return { tsi: [], signal: [] };

      const momentum = [];
      for (let i = 1; i < data.length; i++) {
        momentum.push(data[i].close - data[i - 1].close);
      }

      const absMomentum = momentum.map(v => Math.abs(v));

      const ema1 = ema(momentum, longP);
      const ema2 = ema(ema1, shortP);

      const emaAbs1 = ema(absMomentum, longP);
      const emaAbs2 = ema(emaAbs1, shortP);

      const tsiVals = ema2.map((v, i) => (emaAbs2[i] ? (100 * v) / emaAbs2[i] : 0));

      // сигнальная линия = EMA от TSI
      const signalVals = ema(tsiVals, signalP);

      // выравниваем длину
      while (signalVals.length < tsiVals.length) signalVals.unshift(null);

      return { tsi: tsiVals, signal: signalVals };
    }

    // Render
    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      const res = calculateTSI(candles, long, short, signal);
      tsiVals = res.tsi;
      signalVals = res.signal;

      const lastIdx = tsiVals.length - 1;
      const lastTSI = tsiVals[lastIdx];
      const lastSig = signalVals[lastIdx];

      tsiLine.clear();
      signalLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // 🔹 берём scaleY из менеджера индикаторов
      const obj = chartCore?.indicators?.get('tsi');
      const scaleY = obj?.scaleY ?? 1;

      // --- определяем видимый диапазон + буфер ---
      let firstIdx = 0;
      let lastVisibleIdx = tsiVals.length - 1;
      for (let i = 0; i < tsiVals.length; i++) {
        const x = localLayout.indexToX(i);
        if (x >= 0) { firstIdx = Math.max(0, i - 2); break; }
      }
      for (let i = tsiVals.length - 1; i >= 0; i--) {
        const x = localLayout.indexToX(i);
        if (x <= plotW) { lastVisibleIdx = Math.min(tsiVals.length - 1, i + 2); break; }
      }

      // --- TSI линия ---
      let started = false;
      tsiLine.beginPath();
      for (let i = firstIdx; i <= lastVisibleIdx; i++) {
        const val = tsiVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = plotH / 2 - (val / 100) * (plotH / 2) * scaleY;
        if (!started) { tsiLine.moveTo(x, y); started = true; }
        else tsiLine.lineTo(x, y);
      }
      if (started) tsiLine.stroke({ width: 2, color: colorTSI });

      // --- Signal линия ---
      started = false;
      signalLine.beginPath();
      for (let i = firstIdx; i <= lastVisibleIdx; i++) {
        const val = signalVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = plotH / 2 - (val / 100) * (plotH / 2) * scaleY;
        if (!started) { signalLine.moveTo(x, y); started = true; }
        else signalLine.lineTo(x, y);
      }
      if (started) signalLine.stroke({ width: 2, color: colorSignal });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('tsi', `${long} ${short} ${signal}`);
      }
      if (showVal && overlay?.updateValue && tsiVals.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const valTSI = isHoverLocked ? tsiVals[hoverIdx] : lastTSI;
        const valSig = isHoverLocked ? signalVals[hoverIdx] : lastSig;
        overlay.updateValue('tsi',
          (valTSI != null ? valTSI.toFixed(4) : '') +
          (valSig != null ? ' / ' + valSig.toFixed(4) : '')
        );
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !tsiVals?.length) return;
      const lastIdx = tsiVals.length - 1;

      if (idx == null || idx < 0 || idx >= tsiVals.length) {
        hoverIdx = null;
        const autoTSI = tsiVals[lastIdx];
        const autoSig = signalVals[lastIdx];
        overlay.updateValue('tsi',
          (autoTSI != null ? autoTSI.toFixed(4) : '') +
          (autoSig != null ? ' / ' + autoSig.toFixed(4) : '')
        );
        return;
      }

      hoverIdx = idx;
      const vTSI = tsiVals[idx];
      const vSig = signalVals[idx];
      overlay.updateValue('tsi',
        (vTSI != null ? vTSI.toFixed(4) : '') +
        (vSig != null ? ' / ' + vSig.toFixed(4) : '')
      );
    }

    return { render, updateHover };
  }
};
