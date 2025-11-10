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
      lineWidth: 1.5,
      levels: [30, 70],
      levelColors: [0xFF2E2E, 0x00ff00],
      dashLen: 4,
      gapLen: 6,
      dashThickness: 0.7,
      smooth: 2
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period        = params.period        ?? rsi.meta.defaultParams.period;
    const color         = params.color         ?? rsi.meta.defaultParams.color;
    const lineWidth     = params.lineWidth     ?? rsi.meta.defaultParams.lineWidth;
    const levels        = params.levels        ?? rsi.meta.defaultParams.levels;
    const levelColors   = params.levelColors   ?? rsi.meta.defaultParams.levelColors;
    const dashLen       = params.dashLen       ?? rsi.meta.defaultParams.dashLen;
    const gapLen        = params.gapLen        ?? rsi.meta.defaultParams.gapLen;
    const dashThickness = params.dashThickness ?? rsi.meta.defaultParams.dashThickness;
    const smooth        = params.smooth        ?? rsi.meta.defaultParams.smooth;

    const showPar = true;
    const showVal = true;

    const rsiLine   = new PIXI.Graphics();
    const levelLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    levelLine.zIndex = 5;
    rsiLine.zIndex   = 10;

    layer.addChild(levelLine, rsiLine);

    let values = [];
    let smoothed = [];
    let hoverIdx = null;

    function calculateRSI(data, p) {
      const result = Array(data.length).fill(null);
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
        result[i] = 100 - (100 / (1 + rs));
      }
      return result;
    }

    function smoothArray(arr, windowSize = 2) {
      const out = Array(arr.length).fill(null);
      for (let i = 0; i < arr.length; i++) {
        let sum = 0, count = 0;
        for (let j = 0; j < windowSize; j++) {
          const v = arr[i + j];
          if (v != null) { sum += v; count++; }
        }
        out[i] = count ? sum / count : null;
      }
      return out;
    }

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

    function render(localLayout, globalLayout, baseLayout) {
      if (!smoothed?.length) return;
      if (!localLayout?.plotW || !localLayout?.plotH) return;

      const indexToXPanel = (i) => {
        if (typeof baseLayout?.indexToX !== 'function' || typeof baseLayout?.plotX !== 'number') return null;
        return baseLayout.indexToX(i) - baseLayout.plotX;
      };

      const lastIdx = smoothed.length - 1;
      const lastVal = smoothed[lastIdx];

      rsiLine.clear();
      levelLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('rsi');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, smoothed.length, 2);

      let started = false;
      rsiLine.beginPath();
      for (let i = start; i <= end; i++) {
        const val = smoothed[i];
        if (val == null) continue;

        const x = indexToXPanel(i);
        if (x == null) continue;
        const y = plotH/2 - ((val - 50) / 100) * plotH * scaleY;

        if (!started) { rsiLine.moveTo(x, y); started = true; }
        else { rsiLine.lineTo(x, y); }
      }
      if (started) {
        rsiLine.stroke({ width: lineWidth, color });
      }

      levels.forEach((level, idx) => {
        const y = plotH/2 - ((level - 50) / 100) * plotH * scaleY;
        const lineColor = levelColors[idx] ?? 0xffffff;
        drawDashedHorizontalRects(levelLine, y, plotW, lineColor, dashLen, gapLen, dashThickness);
      });

      if (showPar && overlay?.updateParam) {
        overlay.updateParam('rsi', `${period}`);
      }
      if (showVal && overlay?.updateValue && smoothed.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? smoothed[hoverIdx] : lastVal;
        overlay.updateValue('rsi', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !smoothed?.length) return;
      const lastIdx = smoothed.length - 1;
      if (idx == null || idx < 0 || idx >= smoothed.length) {
        hoverIdx = null;
        const autoVal = smoothed[lastIdx];
        overlay.updateValue('rsi', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }
      hoverIdx = idx;
      const v = smoothed[idx];
      overlay.updateValue('rsi', v != null ? v.toFixed(2) : '');
    }

    return {
      render,
      updateHover,
      calculate: (candles) => {
        values = calculateRSI(candles, period);
        smoothed = smoothArray(values, smooth);
        return smoothed;
      },
      values: smoothed
    };
  }
};
