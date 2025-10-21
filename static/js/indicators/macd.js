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
      barWidthFactor: 0.8
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
      const k = 2 / (p + 1);
      let emaPrev = values[0];
      const result = [emaPrev];
      for (let i = 1; i < values.length; i++) {
        emaPrev = values[i] * k + emaPrev * (1 - k);
        result.push(emaPrev);
      }
      return result;
    }

    // MACD calculation
    function calculate(data, fastP, slowP, signalP) {
      if (!data || data.length < slowP) return { macd: [], signal: [], hist: [] };

      const closes = data.map(c => c.close);
      const emaFast = ema(closes, fastP);
      const emaSlow = ema(closes, slowP);

      const macdVals = closes.map((_, i) =>
        emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
      );

      const signalVals = ema(macdVals.filter(v => v != null), signalP);
      while (signalVals.length < macdVals.length) signalVals.unshift(null);

      const histVals = macdVals.map((v, i) =>
        v != null && signalVals[i] != null ? v - signalVals[i] : null
      );

      return { macd: macdVals, signal: signalVals, hist: histVals };
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      const res = calculate(candles, fast, slow, signalP);
      macdVals = res.macd;
      signalVals = res.signal;
      histVals = res.hist;

      const lastIdx = macdVals.length - 1;
      const lastMACD = macdVals[lastIdx];
      const lastSig  = signalVals[lastIdx];
      const lastHist = histVals[lastIdx];

      macdLine.clear();
      signalLine.clear();
      histoBars.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // 🔹 scaleY
      const obj = chartCore?.indicators?.get('macd');
      const scaleY = obj?.scaleY ?? 1;

      // нулевая линия
      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x555555 });

      // нормализация
      const allVals = [...macdVals, ...signalVals, ...histVals].filter(v => v != null);
      const maxAbs = Math.max(...allVals.map(v => Math.abs(v))) || 1;

      // ширина бара
      const x0 = localLayout.indexToX(0);
      const x1 = localLayout.indexToX(1);
      const candleW = localLayout.candleW ?? Math.max(1, Math.abs(x1 - x0));
      const barW = Math.max(1, candleW * barWidthFactor);

      // --- Гистограмма ---
      for (let i = 0; i < histVals.length; i++) {
        const val = histVals[i];
        if (val == null) continue;

        const xCenter = localLayout.indexToX(i);
        if (xCenter < 0) continue;
        if (xCenter > plotW) break;

        const y0 = zeroY;
        const y1 = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        const color = val >= 0 ? upColor : downColor;

        histoBars.moveTo(xCenter, y0);
        histoBars.lineTo(xCenter, y1);
        histoBars.stroke({ width: barW, color });
      }

      // --- MACD линия ---
      let started = false;
      macdLine.beginPath();
      for (let i = 0; i < macdVals.length; i++) {
        const val = macdVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;
        const y = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        if (!started) { macdLine.moveTo(x, y); started = true; }
        else macdLine.lineTo(x, y);
      }
      if (started) macdLine.stroke({ width: 2, color: colorMACD });

      // --- Signal линия ---
      started = false;
      signalLine.beginPath();
      for (let i = 0; i < signalVals.length; i++) {
        const val = signalVals[i];
        if (val == null) continue;
        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;
        const y = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        if (!started) { signalLine.moveTo(x, y); started = true; }
        else signalLine.lineTo(x, y);
      }
      if (started) signalLine.stroke({ width: 2, color: colorSignal });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('macd', `${fast} ${slow} ${signalP}`);
      }
      if (showVal && overlay?.updateValue && macdVals.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const valMACD = isHoverLocked ? macdVals[hoverIdx] : lastMACD;
        const valSig  = isHoverLocked ? signalVals[hoverIdx] : lastSig;
        const valHist = isHoverLocked ? histVals[hoverIdx] : lastHist;
        overlay.updateValue(
          'macd',
          (valMACD != null ? valMACD.toFixed(2) : '') +
          (valSig != null ? ' / ' + valSig.toFixed(2) : '') +
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

    return { render, updateHover };
  }
};
