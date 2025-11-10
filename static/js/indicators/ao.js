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
      barWidthFactor: 0.8,  // доля от ширины свечи
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const short          = params.short          ?? ao.meta.defaultParams.short;
    const long           = params.long           ?? ao.meta.defaultParams.long;
    const upColor        = params.upColor        ?? ao.meta.defaultParams.upColor;
    const downColor      = params.downColor      ?? ao.meta.defaultParams.downColor;
    const barWidthFactor = params.barWidthFactor ?? ao.meta.defaultParams.barWidthFactor;
    const lineWidth      = params.lineWidth      ?? ao.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const bars     = new PIXI.Graphics();
    const zeroLine = new PIXI.Graphics();

    layer.sortableChildren = true;
    zeroLine.zIndex = 5;
    bars.zIndex     = 10;
    layer.addChild(zeroLine, bars);

    let values = [];
    let hoverIdx = null;

    // SMA helper
    function sma(arr, p) {
      const out = Array(arr.length).fill(null);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= p) sum -= arr[i - p];
        if (i >= p - 1) out[i] = sum / p;
      }
      return out;
    }

    // AO calculation
    function calculate(candles) {
      if (!candles || candles.length < long) {
        values = Array(candles?.length || 0).fill(null);
        return values;
      }
      const med = candles.map(c => (c.high + c.low) / 2);
      const smaShort = sma(med, short);
      const smaLong  = sma(med, long);
      values = med.map((_, i) => {
        if (smaShort[i] == null || smaLong[i] == null) return null;
        return smaShort[i] - smaLong[i];
      });
      return values;
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      bars.clear();
      zeroLine.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('ao');
      const scaleY = obj?.scaleY ?? 1;

      // нулевая линия
      const zeroY = plotH / 2;
      zeroLine.moveTo(0, zeroY);
      zeroLine.lineTo(plotW, zeroY);
      zeroLine.stroke({ width: 0.25, color: 0x444444 });

      // масштаб по максимуму абсолютного значения
      const maxAbs = Math.max(...values.map(v => Math.abs(v) || 0)) || 1;

      // ширина бара как у свечей
      const x0 = localLayout.indexToX(0);
      const x1 = localLayout.indexToX(1);
      const candleW = localLayout.candleW ?? Math.max(1, Math.abs(x1 - x0));
      const barW = Math.max(1, candleW * barWidthFactor);

      const { start, end } = chartCore.indicators.LOD(baseLayout, values.length, 2);

      // --- рисуем только видимый диапазон ---
      for (let i = start; i <= end; i++) {
        const val = values[i];
        if (val == null) continue;

        const xCenter = localLayout.indexToX(i);
        const y0 = zeroY;
        const y1 = zeroY - (val / maxAbs) * (plotH / 2) * scaleY;
        const color = (i > 0 && val > values[i - 1]) ? upColor : downColor;

        bars.moveTo(xCenter, y0);
        bars.lineTo(xCenter, y1);
        bars.stroke({ width: barW, color });
      }

      // overlay
      if (showPar && overlay?.updateParam) {
        overlay.updateParam('ao', `${short}, ${long}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const lastIdx = values.length - 1;
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : values[lastIdx];
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

    return { render, updateHover, calculate, values };
  }
};
