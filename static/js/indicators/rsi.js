// indicators/rsi.js
export const rsi = {
  meta: {
    id: 'rsi',
    name: 'Relative Strength Index',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 14,
      color: 0xffffff,
      levels: [30, 70],
      levelColors: [0xFF2E2E, 0x00ff00],
      fillColor: 0x090909
    }
  },

  createIndicator({ layer }, layout, params = {}) {
    const period      = params.period      ?? rsi.meta.defaultParams.period;
    const color       = params.color       ?? rsi.meta.defaultParams.color;
    const levels      = params.levels      ?? rsi.meta.defaultParams.levels;
    const levelColors = params.levelColors ?? rsi.meta.defaultParams.levelColors;
    const fillColor   = params.fillColor   ?? rsi.meta.defaultParams.fillColor;

    const rsiLine   = new PIXI.Graphics();
    const levelLine = new PIXI.Graphics();
    const fillArea  = new PIXI.Graphics();

    layer.sortableChildren = true;
    fillArea.zIndex  = 0;
    levelLine.zIndex = 5;
    rsiLine.zIndex   = 10;

    layer.addChild(fillArea, levelLine, rsiLine);

    function calculateRSI(data, p) {
      const result = [];
      if (!data || data.length < p + 1) return Array(data?.length || 0).fill(null);
      let gain = 0, loss = 0;
      for (let i = 1; i < p; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gain += diff; else loss -= diff;
      }
      for (let i = p; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const up   = diff > 0 ? diff : 0;
        const down = diff < 0 ? -diff : 0;
        gain = (gain * (p - 1) + up) / p;
        loss = (loss * (p - 1) + down) / p;
        const rs = loss === 0 ? 100 : gain / (loss || 1e-9);
        const rsiVal = 100 - (100 / (1 + rs));
        result.push(rsiVal);
      }
      return Array(p).fill(null).concat(result);
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      const rsiValues = calculateRSI(candles, period);

      rsiLine.clear();
      levelLine.clear();
      fillArea.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // фон
      fillArea.beginFill(fillColor);
      fillArea.drawRect(0, 0, plotW, plotH);
      fillArea.endFill();

      // RSI‑линия
      let started = false;
      rsiLine.beginPath();
      for (let i = 0; i < rsiValues.length; i++) {
        const val = rsiValues[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i); // используем indexToX
        if (x < 0) continue;
        if (x > plotW) break;

        const y = plotH * (1 - val / 100);
        if (!started) {
          rsiLine.moveTo(x, y);
          started = true;
        } else {
          rsiLine.lineTo(x, y);
        }
      }
      if (started) {
        rsiLine.stroke({ width: 2, color });
      }

      // уровни
      levels.forEach((level, idx) => {
        const y = plotH * (1 - level / 100);
        const lineColor = levelColors[idx] ?? 0xffffff;
        levelLine.moveTo(0, y);
        levelLine.lineTo(plotW, y);
        levelLine.stroke({ width: 1, color: lineColor });
      });
    }

    return { render };
  }
};
