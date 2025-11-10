// indicators/tsi.js
export const tsi = {
  meta: {
    id: 'tsi',
    name: 'TSI',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      long: 25,
      short: 13,
      signal: 13,
      colorTSI: 0x2196f3,
      colorSignal: 0xe91e63,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const long        = params.long        ?? tsi.meta.defaultParams.long;
    const short       = params.short       ?? tsi.meta.defaultParams.short;
    const signalPeriod= params.signal      ?? tsi.meta.defaultParams.signal;
    const colorTSI    = params.colorTSI    ?? tsi.meta.defaultParams.colorTSI;
    const colorSignal = params.colorSignal ?? tsi.meta.defaultParams.colorSignal;
    const lineWidth   = params.lineWidth   ?? tsi.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const tsiLine    = new PIXI.Graphics();
    const signalLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    tsiLine.zIndex    = 10;
    signalLine.zIndex = 11;

    layer.addChild(tsiLine, signalLine);

    let tsiVals = [];
    let sigVals = [];
    let hoverIdx = null;

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

    function calculateTSI(data) {
      if (!data || data.length < long + short) return { tsi: [], signal: [] };

      const momentum = [];
      for (let i = 1; i < data.length; i++) {
        momentum.push(data[i].close - data[i - 1].close);
      }

      const absMomentum = momentum.map(v => Math.abs(v));

      const ema1 = ema(momentum, long);
      const ema2 = ema(ema1, short);

      const emaAbs1 = ema(absMomentum, long);
      const emaAbs2 = ema(emaAbs1, short);

      const tsi = ema2.map((v, i) => (emaAbs2[i] ? (100 * v) / emaAbs2[i] : null));
      const sig = ema(tsi.map(v => v ?? 0), signalPeriod);

      while (sig.length < tsi.length) sig.unshift(null);

      tsiVals = tsi;
      sigVals = sig;
      return { tsi, signal: sig };
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!tsiVals?.length || !sigVals?.length) return;

      const indexToXPanel = (i) => {
        if (typeof baseLayout?.indexToX !== 'function' || typeof baseLayout?.plotX !== 'number') return null;
        return baseLayout.indexToX(i) - baseLayout.plotX;
      };

      const lastIdx = tsiVals.length - 1;
      const lastTSI = tsiVals[lastIdx];
      const lastSig = sigVals[lastIdx];

      tsiLine.clear();
      signalLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('tsi');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, tsiVals.length, 2);

      let started = false;
      tsiLine.beginPath();
      for (let i = start; i <= end; i++) {
        const val = tsiVals[i];
        if (val == null) continue;
        const x = indexToXPanel(i);
        const y = plotH / 2 - (val / 100) * (plotH / 2) * scaleY;
        if (!started) { tsiLine.moveTo(x, y); started = true; }
        else { tsiLine.lineTo(x, y); }
      }
      if (started) tsiLine.stroke({ width: lineWidth, color: colorTSI });

      started = false;
      signalLine.beginPath();
      for (let i = start; i <= end; i++) {
        const val = sigVals[i];
        if (val == null) continue;
        const x = indexToXPanel(i);
        const y = plotH / 2 - (val / 100) * (plotH / 2) * scaleY;
        if (!started) { signalLine.moveTo(x, y); started = true; }
        else { signalLine.lineTo(x, y); }
      }
      if (started) signalLine.stroke({ width: lineWidth, color: colorSignal });

      if (showPar && overlay?.updateParam) {
        overlay.updateParam('tsi', `${long} ${short} ${signalPeriod}`);
      }
      if (showVal && overlay?.updateValue && tsiVals.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const valTSI = isHoverLocked ? tsiVals[hoverIdx] : lastTSI;
        const valSig = isHoverLocked ? sigVals[hoverIdx] : lastSig;
        overlay.updateValue('tsi',
          (valTSI != null ? valTSI.toFixed(2) : '') +
          (valSig != null ? ' / ' + valSig.toFixed(2) : '')
        );
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !tsiVals?.length) return;
      const lastIdx = tsiVals.length - 1;

      if (idx == null || idx < 0 || idx >= tsiVals.length) {
        hoverIdx = null;
        const autoTSI = tsiVals[lastIdx];
        const autoSig = sigVals[lastIdx];
        overlay.updateValue('tsi',
          (autoTSI != null ? autoTSI.toFixed(2) : '') +
          (autoSig != null ? ' / ' + autoSig.toFixed(2) : '')
        );
        return;
      }

      hoverIdx = idx;
      const vTSI = tsiVals[idx];
      const vSig = sigVals[idx];
      overlay.updateValue('tsi',
        (vTSI != null ? vTSI.toFixed(2) : '') +
        (vSig != null ? ' / ' + vSig.toFixed(2) : '')
      );
    }

    return {
      render,
      updateHover,
      calculate: (candles) => calculateTSI(candles),
      values: tsiVals
    };
  }
};
