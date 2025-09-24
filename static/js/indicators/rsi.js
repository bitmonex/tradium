// rsi.js
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
      levelColors: [0xff0000, 0x00ff00],
      fillColor: 0x222222
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
    layer.addChild(fillArea, levelLine, rsiLine);
    //Калькуляция
    function calculateRSI(data, p) {
      const result = [];
      if (!data || data.length < p + 1) return result;
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
    //Render
    function render(currentLayout) {
      const candles = currentLayout.candles;
      if (!candles?.length) return;
      const rsiValues = calculateRSI(candles, period);
      rsiLine.clear();
      levelLine.clear();
      fillArea.clear();
      const cw      = (currentLayout.config.candleWidth + currentLayout.config.spacing) * currentLayout.scaleX;
      const plotW   = currentLayout.plotW || 500;
      const plotH   = rsi.meta.height;
      const offsetY = 0;
      const usableW = currentLayout.usableW ?? plotW;
      //BG center
      const yLow  = offsetY + plotH * (1 - levels[0] / 100);
      const yHigh = offsetY + plotH * (1 - levels[1] / 100);
      fillArea.beginFill(fillColor);
      fillArea.drawRect(0, yHigh, usableW, yLow - yHigh);
      fillArea.endFill();
      //RSI линия
      let started = false;
      for (let i = 0; i < rsiValues.length; i++) {
        const val = rsiValues[i];
        if (val == null) continue;
        const x = i * cw + currentLayout.offsetX;
        if (x > usableW) break;
        const y = offsetY + plotH * (1 - val / 100);
        if (!started) {
          rsiLine.moveTo(x, y);
          started = true;
        } else {
          rsiLine.lineTo(x, y);
        }
      }
      rsiLine.stroke({ width: 1, color });
      //Dashed уровней
      function drawDashedLine(g, x1, y, x2, dash = 6, gap = 4, c = 0xffffff) {
        let x = x1;
        while (x < x2) {
          g.moveTo(x, y);
          const xEnd = Math.min(x + dash, x2);
          g.lineTo(xEnd, y);
          g.stroke({ width: 1, color: c });
          x = xEnd + gap;
        }
      }
      levels.forEach((level, idx) => {
        const y = offsetY + plotH * (1 - level / 100);
        const lineColor = levelColors[idx] ?? 0x666666;
        drawDashedLine(levelLine, 0, y, usableW, 6, 4, lineColor);
      });
    }
    return { render };
  }
};