// indicators/rsi.js
export const rsi = {
  meta: {
    id: 'rsi',
    name: 'RSI',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 14,
      color: 0xffffff,
      levels: [30, 70],
      levelColors: [0xFF2E2E, 0x00ff00], // красный для 30, зелёный для 70
      dashLen: 4,   // длина штриха
      gapLen: 6,    // длина промежутка
      dashThickness: 0.7 // толщина dashed
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const period        = params.period        ?? rsi.meta.defaultParams.period;
    const color         = params.color         ?? rsi.meta.defaultParams.color;
    const levels        = params.levels        ?? rsi.meta.defaultParams.levels;
    const levelColors   = params.levelColors   ?? rsi.meta.defaultParams.levelColors;
    const dashLen       = params.dashLen       ?? rsi.meta.defaultParams.dashLen;
    const gapLen        = params.gapLen        ?? rsi.meta.defaultParams.gapLen;
    const dashThickness = params.dashThickness ?? rsi.meta.defaultParams.dashThickness;

    const showPar = true;
    const showVal = true;

    const rsiLine   = new PIXI.Graphics();
    const levelLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    levelLine.zIndex = 5;
    rsiLine.zIndex   = 10;

    layer.addChild(levelLine, rsiLine);

    let values = [];
    let hoverIdx = null;

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

    // Хелпер: пунктирная горизонтальная линия «кирпичиками»
    function drawDashedHorizontalRects(gfx, y, width, color, dash = 6, gap = 4, thickness = 1) {
      const yy = Math.round(y) + 0.5 - (thickness / 2);
      let x = 0;
      while (x < width) {
        const w = Math.min(dash, width - x);
        gfx.beginFill(color);
        gfx.drawRect(x, yy, w, thickness);
        gfx.endFill();
        x += dash + gap;
      }
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculateRSI(candles, period);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      rsiLine.clear();
      levelLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // линия RSI
      let started = false;
      rsiLine.beginPath();
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const x = localLayout.indexToX(i);
        if (x < 0) continue;
        if (x > plotW) break;

        const y = plotH * (1 - val / 100);
        if (!started) { rsiLine.moveTo(x, y); started = true; }
        else { rsiLine.lineTo(x, y); }
      }
      if (started) {
        rsiLine.stroke({ width: 2, color });
      }

      // уровни (пунктир: красный 30, зелёный 70)
      levels.forEach((level, idx) => {
        const y = plotH * (1 - level / 100);
        const lineColor = levelColors[idx] ?? 0xffffff;
        drawDashedHorizontalRects(levelLine, y, plotW, lineColor, dashLen, gapLen, dashThickness);
      });

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('rsi', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('rsi', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('rsi', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('rsi', v != null ? v.toFixed(2) : '');
    }

    return { render, updateHover };
  }
};
