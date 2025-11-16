export const vpvr = {
  meta: {
    id: 'vpvr',
    name: 'Volume Profile Visible Range',
    position: 'right',
    zIndex: 5,
    width: 200,
    defaultParams: {
      rows: 120,
      side: 'right',
      direction: 'inward',
      upColor: 0x548431,
      downColor: 0x6B1025,
      upColorDim: 0x2F4F1A,
      downColorDim: 0x4A0C1B,
      pocColor: 0xff0000,
      pocLineWidth: 2,
      vahval: true,
      vahColor: 0x43E300,
      valColor: 0x00F6FA,
      vahvalLineWidth: 1
    }
  },

  createIndicator({ layer, overlay }, layout, params = {}) {
    const {
      rows, side, direction,
      upColor, downColor, upColorDim, downColorDim,
      pocColor, pocLineWidth, vahval, vahColor, valColor,
      vahvalLineWidth
    } = { ...vpvr.meta.defaultParams, ...params };

    const bars = new PIXI.Graphics();
    const pocLine = new PIXI.Graphics();
    const vahvalLines = new PIXI.Graphics();

    layer.alpha = 1;
    bars.alpha = 1;
    pocLine.alpha = 1;
    vahvalLines.alpha = 1;

    layer.sortableChildren = true;
    bars.zIndex = 5;
    pocLine.zIndex = 6;
    vahvalLines.zIndex = 7;
    layer.addChild(bars, pocLine, vahvalLines);

    let profile = [];
    let pocIdx = null;
    let vahIdx = null;
    let valIdx = null;
    let aggBuy = 0, aggSell = 0, aggTotal = 0, aggDelta = 0;
    let lastHash = null;
    let hoverLastHash = null;

    function splitCandleVolume(c) {
      const v = Number(c?.volume) || 0;
      if (c.close > c.open) return { up: v, down: 0 };
      if (c.close < c.open) return { up: 0, down: v };
      const half = v / 2;
      return { up: half, down: half };
    }

    function calculate(candles, layout) {
      const denom = layout.spacing * layout.scaleX;
      if (!Number.isFinite(denom) || denom === 0 || !candles?.length || rows <= 0) return [];

      const start = Math.max(0, Math.floor((layout.plotX - layout.offsetX) / denom));
      const end = Math.min(
        candles.length - 1,
        Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / denom) - 1
      );
      const hash = candles[start]?.time + ':' + candles[end]?.time;
      if (hash === lastHash) return profile;
      lastHash = hash;

      const slice = candles.slice(start, end + 1);
      const minPrice = Math.min(...slice.map(c => c.low));
      const maxPrice = Math.max(...slice.map(c => c.high));
      if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice === maxPrice) {
        profile = []; aggBuy = aggSell = aggTotal = aggDelta = 0;
        pocIdx = vahIdx = valIdx = null;
        return profile;
      }

      const step = (maxPrice - minPrice) / rows;
      const upBins = Array(rows).fill(0);
      const downBins = Array(rows).fill(0);

      for (const c of slice) {
        const { up, down } = splitCandleVolume(c);
        const lo = Math.floor((c.low  - minPrice) / step);
        const hi = Math.floor((c.high - minPrice) / step);
        const idxLow = Math.max(0, lo);
        const idxHigh = Math.min(rows - 1, hi);
        const span = Math.max(1, idxHigh - idxLow + 1);
        const upPerBin = up / span;
        const downPerBin = down / span;
        for (let i = idxLow; i <= idxHigh; i++) {
          upBins[i] += upPerBin;
          downBins[i] += downPerBin;
        }
      }

      profile = upBins.map((u, i) => {
        const d = downBins[i];
        return {
          priceLow:  minPrice + i * step,
          priceHigh: minPrice + (i + 1) * step,
          up:        u,
          down:      d,
          total:     u + d
        };
      });

      aggBuy   = profile.reduce((a, p) => a + p.up, 0);
      aggSell  = profile.reduce((a, p) => a + p.down, 0);
      aggTotal = aggBuy + aggSell;
      aggDelta = aggBuy - aggSell;

      pocIdx = profile.reduce((maxIdx, p, i) => p.total > profile[maxIdx].total ? i : maxIdx, 0);

      if (vahval) {
        const target = aggTotal * 0.7;
        let acc = 0;
        const sorted = [...profile].sort((a, b) => b.total - a.total);
        const included = [];
        for (const p of sorted) {
          if (acc >= target) break;
          acc += p.total;
          included.push(p);
        }
        const minLow = Math.min(...included.map(p => p.priceLow));
        const maxHigh = Math.max(...included.map(p => p.priceHigh));
        valIdx = profile.findIndex(p => p.priceLow <= minLow && p.priceHigh > minLow);
        vahIdx = profile.findIndex(p => p.priceLow < maxHigh && p.priceHigh >= maxHigh);
      }

      return profile;
    }

    function render(layout) {
      const candles = layout?.candles;
      if (!candles?.length) return;
      calculate(candles, layout);
      if (!profile.length) return;

      bars.clear(); pocLine.clear(); vahvalLines.clear();

      const plotX = layout.plotX;
      const plotW = layout.plotW;
      const width = vpvr.meta.width;
      const yFromPrice = (price) => layout.priceToY(price);
      const baseX = (side === 'right') ? (plotX + plotW) : plotX;
      const maxTotal = Math.max(...profile.map(p => p.total)) || 1;

      for (let i = 0; i < profile.length; i++) {
        const p = profile[i];
        const yTop = yFromPrice(p.priceHigh);
        const yBot = yFromPrice(p.priceLow);
        const rawHeight = Math.abs(yBot - yTop);
        const height = Math.max(1, rawHeight - 1);
        const yMid = (yTop + yBot) / 2;
        const y = yMid - height / 2;

        const inVA = vahval && vahIdx != null && valIdx != null && i >= valIdx && i <= vahIdx;
        const baseColor = inVA ? downColor : downColorDim;
        const insertColor = inVA ? upColor : upColorDim;

        const lenTotal = (p.total / maxTotal) * width;
        const lenUp    = (p.up    / maxTotal) * width;

        bars.beginFill(baseColor, 1);
        if (side === 'right') {
          if (direction === 'inward') bars.drawRect(baseX - lenTotal, y, lenTotal, height);
          else                        bars.drawRect(baseX, y, lenTotal, height);
        } else {
          if (direction === 'inward') bars.drawRect(baseX, y, lenTotal, height);
          else                        bars.drawRect(baseX - lenTotal, y, lenTotal, height);
        }
        bars.endFill();

        if (lenUp > 0) {
          bars.beginFill(insertColor, 1);
          if (side === 'right') {
            if (direction === 'inward') bars.drawRect(baseX - lenUp, y, lenUp, height);
            else                        bars.drawRect(baseX, y, lenUp, height);
          } else {
            if (direction === 'inward') bars.drawRect(baseX, y, lenUp, height);
            else                        bars.drawRect(baseX - lenUp, y, lenUp, height);
          }
          bars.endFill();
        }
      }

      if (pocIdx != null) {
        const pocYTop = yFromPrice(profile[pocIdx].priceHigh);
        const pocYBot = yFromPrice(profile[pocIdx].priceLow);
        const pocY = (pocYTop + pocYBot) / 2;
        pocLine.moveTo(plotX, pocY);
        pocLine.lineTo(plotX + plotW, pocY);
        pocLine.stroke({ width: pocLineWidth, color: pocColor });
      }

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

    function updateHover(candle, idx) {
      if (!candle || !layout || !layout.candles?.length) return;

      const denom = layout.spacing * layout.scaleX;
      const start = Math.max(0, Math.floor((layout.plotX - layout.offsetX) / denom));
      const end = Math.min(
        layout.candles.length - 1,
        Math.ceil((layout.plotX + layout.plotW - layout.offsetX) / denom) - 1
      );
      const hash = layout.candles[start]?.time + ':' + layout.candles[end]?.time;
      if (hash !== hoverLastHash) {
        calculate(layout.candles, layout);
        hoverLastHash = hash;
      }

      const fmt = (n, d = 6) => Number.isFinite(n) ? n.toFixed(d) : '0';
      const fmtPct = (num, den) => {
        const pct = den > 0 ? ((num / den) * 100) : 0;
        const sign = num >= 0 ? '+' : '';
        return `${sign}${fmt(num, 3)} (${sign}${pct.toFixed(2)}%)`;
      };

      const b = aggBuy, s = aggSell, sum = aggTotal, d = aggDelta;
      const vpvrDelta = fmtPct(d, sum);

      const line = `VPVR: B: ${fmt(b, 6)}  S: ${fmt(s, 6)}  Σ: ${fmt(sum, 6)}  Δ: ${vpvrDelta}`;
      console.log(line);

      if (overlay?.updateValue) {
        overlay.updateValue('vpvr', line);
      }
    }

    return {
      render,
      calculate: () => profile,
      values: profile,
      updateHover,
      getAggregates: () => ({ buy: aggBuy, sell: aggSell, total: aggTotal, delta: aggDelta })
    };
  }
};
