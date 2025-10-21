// indicators/ao.js
export const ao = {
  meta: {
    id: 'ao',
    name: 'Awesome Oscillator',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      short: 5,
      long: 34,
      upColor: 0x00ff00,    // зелёные бары
      downColor: 0xff2e2e,  // красные бары
      fillColor: 0x161616,
      barWidthFactor: 0.8   // доля от ширины свечи
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const short          = params.short          ?? ao.meta.defaultParams.short;
    const long           = params.long           ?? ao.meta.defaultParams.long;
    const upColor        = params.upColor        ?? ao.meta.defaultParams.upColor;
    const downColor      = params.downColor      ?? ao.meta.defaultParams.downColor;
    const fillColor      = params.fillColor      ?? ao.meta.defaultParams.fillColor;
    const barWidthFactor = params.barWidthFactor ?? ao.meta.defaultParams.barWidthFactor;

    const showPar = true;
    const showVal = true;

    const bars     = new PIXI.Graphics();
    const zeroLine = new PIXI.Graphics();
    const fillArea = new PIXI.Graphics();

    layer.sortableChildren = true;
    fillArea.zIndex = 0;
    zeroLine.zIndex = 5;
    bars.zIndex     = 10;

    layer.addChild(fillArea, zeroLine, bars);

    let values = [];
    let hoverIdx = null;

    // SMA helper
    function sma(values, p) {
      const result = [];
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= p) sum -= values[i - p];
        result.push(i >= p - 1 ? sum / p : null);
      }
      return result;
    }

    // AO calculation
    function calculate(data, shortP, longP) {
      if (!data || data.length < longP) return Array(data?.length || 0).fill(null);
      const med = data.map(c => (c.high + c.low) / 2);
      const smaShort = sma(med, shortP);
      const smaLong  = sma(med, longP);
      return med.map((_, i) => {
        if (smaShort[i] == null || smaLong[i] == null) return null;
        return smaShort[i] - smaLong[i];
      });
    }

    function render(localLayout) {
      const candles = localLayout.candles;
      if (!candles?.length) return;

      values = calculate(candles, short, long);

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      bars.clear();
      zeroLine.clear();
      fillArea.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;

      // фон
      fillArea.beginFill(fillColor);
      fillArea.drawRect(0, 0, plotW, plotH);
      fillArea.endFill();

      // нулевая линия
      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x444444 });

      // масштаб по максимуму абсолютного значения
      const maxAbs = Math.max(...values.map(v => Math.abs(v) || 0)) || 1;

      // ширина свечи: берём либо candleW, либо дельту между индексами
      const x0 = localLayout.indexToX(0);
      const x1 = localLayout.indexToX(1);
      const candleW = localLayout.candleW ?? Math.max(1, Math.abs(x1 - x0));
      const barW = Math.max(1, candleW * barWidthFactor);

      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        const xCenter = localLayout.indexToX(i);
        if (xCenter < 0) continue;
        if (xCenter > plotW) break;

        const y0 = zeroY;
        const y1 = zeroY - (val / maxAbs) * (plotH / 2);
        const color = (i > 0 && val > values[i - 1]) ? upColor : downColor;

        // рисуем вертикальный бар, центрированный по xCenter
        bars.moveTo(xCenter, y0);
        bars.lineTo(xCenter, y1);
        bars.stroke({ width: barW, color });
      }

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('ao', `${short}, ${long}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('ao', val != null ? val.toFixed(2) : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('ao', autoVal != null ? autoVal.toFixed(2) : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('ao', v != null ? v.toFixed(2) : '');
    }

    return { render, updateHover };
  }
};
