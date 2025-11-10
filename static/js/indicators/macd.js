// indicators/macd.js
export const macd = {
  meta: {
    id: 'macd',
    name: 'MACD',
    position: 'bottom',
    zIndex: 50,
    height: 120,
    defaultParams: {
      fast: 12,
      slow: 26,
      signal: 9,
      colorMACD: 0x2BA4FF,   // MACD линия
      colorSignal: 0xFF8000, // сигнальная линия
      upColor: 0x00ff00,     // зелёные бары гистограммы
      downColor: 0xff2e2e,   // красные бары гистограммы
      barWidthFactor: 0.8,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const fast        = params.fast        ?? macd.meta.defaultParams.fast;
    const slow        = params.slow        ?? macd.meta.defaultParams.slow;
    const signalP     = params.signal      ?? macd.meta.defaultParams.signal;
    const colorMACD   = params.colorMACD   ?? macd.meta.defaultParams.colorMACD;
    const colorSignal = params.colorSignal ?? macd.meta.defaultParams.colorSignal;
    const upColor     = params.upColor     ?? macd.meta.defaultParams.upColor;
    const downColor   = params.downColor   ?? macd.meta.defaultParams.downColor;
    const barWidthFactor = params.barWidthFactor ?? macd.meta.defaultParams.barWidthFactor;
    const lineWidth   = params.lineWidth   ?? macd.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const macdLine   = new PIXI.Graphics();
    const signalLine = new PIXI.Graphics();
    const histoBars  = new PIXI.Graphics();
    const zeroLine   = new PIXI.Graphics();

    layer.sortableChildren = true;
    zeroLine.zIndex   = 5;
    histoBars.zIndex  = 6;
    macdLine.zIndex   = 10;
    signalLine.zIndex = 11;

    layer.addChild(zeroLine, histoBars, macdLine, signalLine);

    let macdVals = [];
    let signalVals = [];
    let histVals = [];
    let hoverIdx = null;

    // EMA helper
    function ema(values, p) {
      const out = Array(values.length).fill(null);
      const k = 2 / (p + 1);
      let emaPrev = values[0];
      out[0] = emaPrev;
      for (let i = 1; i < values.length; i++) {
        emaPrev = values[i] * k + emaPrev * (1 - k);
        out[i] = emaPrev;
      }
      return out;
    }

    // MACD calculation
    function calculate(candles) {
      if (!candles || candles.length < slow) return { macd: [], signal: [], hist: [] };

      const closes = candles.map(c => c.close);
      const emaFast = ema(closes, fast);
      const emaSlow = ema(closes, slow);

      macdVals = closes.map((_, i) =>
        emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
      );

      signalVals = ema(macdVals.map(v => v ?? 0), signalP);
      while (signalVals.length < macdVals.length) signalVals.unshift(null);

      histVals = macdVals.map((v, i) =>
        v != null && signalVals[i] != null ? v - signalVals[i] : null
      );

      return macdVals;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!macdVals?.length) return;

      macdLine.clear();
      signalLine.clear();
      histoBars.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('macd');
      const scaleY = obj?.scaleY ?? 1;

      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x555555 });

      const allVals = [...macdVals, ...signalVals, ...histVals].filter(v => v != null);
      const maxAbs = Math.max(...allVals.map(v => Math.abs(v))) || 1;

      const x0 = localLayout.indexToX(0);
      const x1 = localLayout.indexToX(1);
      const candleW = localLayout.candleW ?? Math.max(1, Math.abs(x1 - x0));
      const barW = Math.max(1, candleW * barWidthFactor);

      const { start, end } = chartCore.indicators.LOD(baseLayout, macdVals.length, 2);

      // Histogram
      for (let i = start; i <= end; i++) {
        const val = histVals[i];
        if (val == null) continue;
        const xCenter = localLayout.indexToX(i);
        const y0 = zeroY;
        const y1 = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        const color = val >= 0 ? upColor : downColor;
        histoBars.moveTo(xCenter, y0);
        histoBars.lineTo(xCenter, y1);
        histoBars.stroke({ width: barW, color });
      }

      // MACD line
      let started = false;
      macdLine.beginPath();
      for (let i = start; i <= end; i++) {
        const val = macdVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        if (!started) { macdLine.moveTo(x, y); started = true; }
        else macdLine.lineTo(x, y);
      }
      if (started) macdLine.stroke({ width: lineWidth, color: colorMACD });

      // Signal line
      started = false;
      signalLine.beginPath();
      for (let i = start; i <= end; i++) {
        const val = signalVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        const y = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        if (!started) { signalLine.moveTo(x, y); started = true; }
        else signalLine.lineTo(x, y);
      }
      if (started) signalLine.stroke({ width: lineWidth, color: colorSignal });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('macd', `${fast} ${slow} ${signalP}`);
      }
      if (showVal && overlay?.updateValue && macdVals.length) {
        const lastIdx = macdVals.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const valMACD = isHoverLocked ? macdVals[hoverIdx] : macdVals[lastIdx];
        const valSig  = isHoverLocked ? signalVals[hoverIdx] : signalVals[lastIdx];
        const valHist = isHoverLocked ? histVals[hoverIdx] : histVals[lastIdx];
        overlay.updateValue(
          'macd',
          (valMACD != null ? valMACD.toFixed(2) : '') +
          (valSig  != null ? ' / ' + valSig.toFixed(2) : '') +
          (valHist != null ? ' / ' + valHist.toFixed(2) : '')
        );
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !macdVals?.length) return;
      const lastIdx = macdVals.length - 1;

      if (idx == null || idx < 0 || idx >= macdVals.length) {
        hoverIdx = null;
        const autoMACD = macdVals[lastIdx];
        const autoSig  = signalVals[lastIdx];
        const autoHist = histVals[lastIdx];
        overlay.updateValue(
          'macd',
          (autoMACD != null ? autoMACD.toFixed(2) : '') +
          (autoSig  != null ? ' / ' + autoSig.toFixed(2) : '') +
          (autoHist != null ? ' / ' + autoHist.toFixed(2) : '')
        );
        return;
      }

      hoverIdx = idx;
      const vMACD = macdVals[idx];
      const vSig  = signalVals[idx];
      const vHist = histVals[idx];
      overlay.updateValue(
        'macd',
        (vMACD != null ? vMACD.toFixed(2) : '') +
        (vSig  != null ? ' / ' + vSig.toFixed(2) : '') +
        (vHist != null ? ' / ' + vHist.toFixed(2) : '')
      );
    }

    return { render, updateHover, calculate, values: macdVals };
  }
};

