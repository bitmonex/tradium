// indicators/volatility-ohlc.js
export const volatilityOHLC = {
  meta: {
    id: 'volatilityOHLC',
    name: 'Volatility OHLC',
    position: 'bottom',
    zIndex: 50,
    height: 100,
    defaultParams: {
      period: 10,
      color: 0x00ff00,
      lineWidth: 1.5
    }
  },

  createIndicator({ layer, overlay, chartCore }, layout, params = {}) {
    const period    = params.period ?? volatilityOHLC.meta.defaultParams.period;
    const color     = params.color  ?? volatilityOHLC.meta.defaultParams.color;
    const lineWidth = params.lineWidth ?? volatilityOHLC.meta.defaultParams.lineWidth;

    const showPar = true;
    const showVal = true;

    const line = new PIXI.Graphics();
    layer.sortableChildren = true;
    line.zIndex = 10;
    layer.addChild(line);

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

    // Volatility calculation
    function calculate(candles, p) {
      if (!candles || candles.length < p) return Array(candles?.length || 0).fill(null);

      const vols = Array(candles.length).fill(null);
      for (let i = 1; i < candles.length; i++) {
        vols[i] = ((candles[i].high - candles[i].low) / candles[i - 1].close) * 100;
      }
      return sma(vols, p);
    }

    function render(localLayout, globalLayout, baseLayout) {
      if (!values?.length) return;

      const indexToXPanel = (i) => {
        if (typeof baseLayout?.indexToX !== 'function' || typeof baseLayout?.plotX !== 'number') return null;
        return baseLayout.indexToX(i) - baseLayout.plotX;
      };

      const lastIdx = values.length - 1;
      const lastVal = values[lastIdx];

      line.clear();

      const plotW = localLayout.plotW;
      const plotH = localLayout.plotH;
      const obj = chartCore?.indicators?.get('volatilityOHLC');
      const scaleY = obj?.scaleY ?? 1;

      const { start, end } = chartCore.indicators.LOD(baseLayout, values.length, 2);

      const maxVal = Math.max(...values.filter(v => v != null)) || 1;

      let started = false;
      line.beginPath();
      for (let i = start; i <= end; i++) {
        const val = values[i];
        if (val == null) continue;
        const x = indexToXPanel(i);
        const y = plotH * (1 - (val / maxVal) * scaleY);
        if (!started) { line.moveTo(x, y); started = true; }
        else line.lineTo(x, y);
      }
      if (started) line.stroke({ width: lineWidth, color });

      if (showPar && overlay?.updateParam) {
        overlay.updateParam('volatilityOHLC', `${period}`);
      }
      if (showVal && overlay?.updateValue && values.length) {
        const isHoverLocked = hoverIdx != null && hoverIdx !== lastIdx;
        const val = isHoverLocked ? values[hoverIdx] : lastVal;
        overlay.updateValue('volatilityOHLC', val != null ? val.toFixed(2) + '%' : '');
      }
    }

    function updateHover(candle, idx) {
      if (!showVal || !overlay?.updateValue || !values?.length) return;
      const lastIdx = values.length - 1;

      if (idx == null || idx < 0 || idx >= values.length) {
        hoverIdx = null;
        const autoVal = values[lastIdx];
        overlay.updateValue('volatilityOHLC', autoVal != null ? autoVal.toFixed(2) + '%' : '');
        return;
      }

      hoverIdx = idx;
      const v = values[idx];
      overlay.updateValue('volatilityOHLC', v != null ? v.toFixed(2) + '%' : '');
    }

    return {
      render,
      updateHover,
      calculate: (candles) => {
        values = calculate(candles, period);
        return values;
      },
      values
    };
  }
};
