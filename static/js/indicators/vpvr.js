export const vpvr = {
  meta: {
    id: 'vpvr',
    name: 'Volume Profile Visible Range',
    position: 'right',
    zIndex: 50,
    width: 200,
    defaultParams: {
      rows: 240,             // количество строк (24..240)
      side: 'right',         // 'left' или 'right'
      direction: 'inward',   // 'inward' (бары внутрь графика) или 'outward' (наружу)
      upColor: 0x00ff00,     // цвет баров профиля
      pocColor: 0xff0000,    // цвет линии POC
      pocLineWidth: 2,       // толщина линии POC
      vahval: true,          // включение Value Area High/Low
      vahColor: 0x0000ff,    // цвет VAH
      valColor: 0x0000ff,    // цвет VAL
      vahvalLineWidth: 1.5,  // толщина VAH/VAL
      candleOpacity: 1.0     // прозрачность баров профиля (0.5 = 50%)
    }
  },

  createIndicator({ layer }, layout, params = {}) {
    const rows            = params.rows            ?? vpvr.meta.defaultParams.rows;
    const side            = params.side            ?? vpvr.meta.defaultParams.side;
    const direction       = params.direction       ?? vpvr.meta.defaultParams.direction;
    const upColor         = params.upColor         ?? vpvr.meta.defaultParams.upColor;
    const pocColor        = params.pocColor        ?? vpvr.meta.defaultParams.pocColor;
    const pocLineWidth    = params.pocLineWidth    ?? vpvr.meta.defaultParams.pocLineWidth;
    const vahval          = params.vahval          ?? vpvr.meta.defaultParams.vahval;
    const vahColor        = params.vahColor        ?? vpvr.meta.defaultParams.vahColor;
    const valColor        = params.valColor        ?? vpvr.meta.defaultParams.valColor;
    const vahvalLineWidth = params.vahvalLineWidth ?? vpvr.meta.defaultParams.vahvalLineWidth;
    const candleOpacity   = params.candleOpacity   ?? vpvr.meta.defaultParams.candleOpacity;

    const bars = new PIXI.Graphics();
    const pocLine = new PIXI.Graphics();
    const vahvalLines = new PIXI.Graphics();

    layer.sortableChildren = true;
    bars.zIndex = 10;
    pocLine.zIndex = 11;
    vahvalLines.zIndex = 12;
    layer.addChild(bars, pocLine, vahvalLines);

    let profile = [];
    let pocIdx = null;
    let vahIdx = null;
    let valIdx = null;

    // --- расчёт профиля по видимому окну ---
    function calculate(candles, localLayout) {
      if (!candles?.length || rows <= 0) return [];

      const denom = localLayout.spacing * localLayout.scaleX;
      if (!Number.isFinite(denom) || denom === 0) return [];

      const start = Math.max(0, Math.floor((localLayout.plotX - localLayout.offsetX) / denom));
      const end = Math.min(
        candles.length - 1,
        Math.ceil((localLayout.plotX + localLayout.plotW - localLayout.offsetX) / denom) - 1
      );
      const slice = candles.slice(start, end + 1);
      if (!slice.length) return [];

      const minPrice = Math.min(...slice.map(c => c.low));
      const maxPrice = Math.max(...slice.map(c => c.high));
      if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice === maxPrice) return [];

      const step = (maxPrice - minPrice) / rows;
      const bins = Array(rows).fill(0);

      for (const c of slice) {
        const vol = c.volume ?? 0;
        const lo = Math.floor((c.low  - minPrice) / step);
        const hi = Math.floor((c.high - minPrice) / step);
        const idxLow = Math.max(0, lo);
        const idxHigh = Math.min(rows - 1, hi);
        for (let i = idxLow; i <= idxHigh; i++) bins[i] += vol;
      }

      profile = bins.map((v, i) => ({
        priceLow:  minPrice + i * step,
        priceHigh: minPrice + (i + 1) * step,
        volume:    v
      }));

      // POC
      let maxVol = -Infinity;
      pocIdx = null;
      for (let i = 0; i < profile.length; i++) {
        if (profile[i].volume > maxVol) { maxVol = profile[i].volume; pocIdx = i; }
      }

      // VAH/VAL
      if (vahval) {
        const totalVol = profile.reduce((a, p) => a + p.volume, 0);
        const targetVol = totalVol * 0.7;
        let acc = 0;
        const sorted = [...profile].sort((a, b) => b.volume - a.volume);
        const included = [];
        for (const p of sorted) {
          if (acc >= targetVol) break;
          acc += p.volume;
          included.push(p);
        }
        const minLow = Math.min(...included.map(p => p.priceLow));
        const maxHigh = Math.max(...included.map(p => p.priceHigh));
        valIdx = profile.findIndex(p => p.priceLow <= minLow && p.priceHigh > minLow);
        vahIdx = profile.findIndex(p => p.priceLow < maxHigh && p.priceHigh >= maxHigh);
      }

      return profile;
    }

    // --- отрисовка ---
    function render(localLayout) {
      const candles = localLayout?.candles;
      if (!candles?.length) return;

      calculate(candles, localLayout);
      if (!profile.length) return;

      bars.clear();
      pocLine.clear();
      vahvalLines.clear();

      const plotX = localLayout.plotX;
      const plotW = localLayout.plotW;
      const width = vpvr.meta.width;
      const yFromPrice = (price) => localLayout.priceToY(price);

      const maxVol = Math.max(...profile.map(p => p.volume)) || 1;

      const baseX = (side === 'right') ? (plotX + plotW) : plotX;

      // бары профиля
      for (let i = 0; i < profile.length; i++) {
        const p = profile[i];
        const yTop = yFromPrice(p.priceHigh);
        const yBot = yFromPrice(p.priceLow);
        const height = Math.max(1, Math.abs(yBot - yTop));
        const len = (p.volume / maxVol) * width;
        const color = (i === pocIdx) ? pocColor : upColor;

        bars.beginFill(color, candleOpacity);

        if (side === 'right') {
          if (direction === 'inward') {
            // внутрь графика
            bars.drawRect(baseX - len, Math.min(yTop, yBot), len, height);
          } else {
            // наружу вправо
            bars.drawRect(baseX, Math.min(yTop, yBot), len, height);
          }
        } else {
          if (direction === 'inward') {
            // внутрь графика
            bars.drawRect(baseX, Math.min(yTop, yBot), len, height);
          } else {
            // наружу влево
            bars.drawRect(baseX - len, Math.min(yTop, yBot), len, height);
          }
        }

        bars.endFill();
      }

      // линия POC
      if (pocIdx != null) {
        const pocYTop = yFromPrice(profile[pocIdx].priceHigh);
        const pocYBot = yFromPrice(profile[pocIdx].priceLow);
        const pocY = (pocYTop + pocYBot) / 2;
        pocLine.moveTo(plotX, pocY);
        pocLine.lineTo(plotX + plotW, pocY);
        pocLine.stroke({ width: pocLineWidth, color: pocColor });
      }

      // линии VAH/VAL
      if (vahval && vahIdx != null && valIdx != null) {
        const vahY = yFromPrice(profile[vahIdx].priceHigh);
        const valY = yFromPrice(profile[valIdx].priceLow);

        vahvalLines.moveTo(plotX, vahY);
        vahvalLines.lineTo(plotX + plotW, vahY);
        vahvalLines.stroke({ width: vahvalLineWidth, color: vahColor });

        vahvalLines.moveTo(plotX, valY);
        vahvalLines.lineTo(plotX + plotW, valY);
        vahvalLines.stroke({ width: vahvalLineWidth, color: valColor });
      }
    }

    return { render, calculate: () => profile, values: profile };
  }
};
