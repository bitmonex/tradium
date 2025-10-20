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
      colorTSI: 0x00ffff,   // основная линия
      colorSignal: 0xff2e2e // сигнальная линия
    }
  },

  createIndicator({ layer }, layout, params = {}) {
    const long = params.long ?? tsi.meta.defaultParams.long;
    const short = params.short ?? tsi.meta.defaultParams.short;
    const signal = params.signal ?? tsi.meta.defaultParams.signal;
    const colorTSI = params.colorTSI ?? tsi.meta.defaultParams.colorTSI;
    const colorSignal = params.colorSignal ?? tsi.meta.defaultParams.colorSignal;

    const tsiLine = new PIXI.Graphics();
    const signalLine = new PIXI.Graphics();
    layer.addChild(tsiLine, signalLine);

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
    function render(currentLayout) {
      const candles = currentLayout.candles;
      if (!candles?.length) return;

      const { tsi: tsiVals, signal: signalVals } = calculateTSI(candles, long, short, signal);

      tsiLine.clear();
      signalLine.clear();

      const plotH = tsi.meta.height;

      // --- TSI линия ---
      let started = false;
      for (let i = 0; i < tsiVals.length; i++) {
        const val = tsiVals[i];
        if (val == null) continue;
        const x = currentLayout.indexToX(i); // ✅ правильный X
        const y = plotH / 2 - (val / 100) * (plotH / 2);
        if (!started) { tsiLine.moveTo(x, y); started = true; }
        else tsiLine.lineTo(x, y);
      }
      if (started) tsiLine.stroke({ width: 1.5, color: colorTSI });

      // --- Signal линия ---
      started = false;
      for (let i = 0; i < signalVals.length; i++) {
        const val = signalVals[i];
        if (val == null) continue;
        const x = currentLayout.indexToX(i); // ✅ правильный X
        const y = plotH / 2 - (val / 100) * (plotH / 2);
        if (!started) { signalLine.moveTo(x, y); started = true; }
        else signalLine.lineTo(x, y);
      }
      if (started) signalLine.stroke({ width: 1, color: colorSignal });
    }

    return { render };
  }
};
