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

  createIndicator({ layer, chartCore }, layout, params = {}) {
    const {
      rows, side, direction,
      upColor, downColor, upColorDim, downColorDim,
      pocColor, pocLineWidth, vahval, vahColor, valColor,
      vahvalLineWidth
    } = { ...vpvr.meta.defaultParams, ...params };

    const bars = new PIXI.Graphics();
    const pocLine = new PIXI.Graphics();
    const vahvalLines = new PIXI.Graphics();

    layer.sortableChildren = true;
    bars.zIndex = 5;
    pocLine.zIndex = 6;
    vahvalLines.zIndex = 7;
    layer.addChild(bars, pocLine, vahvalLines);

    let profile = [];
    let pocIdx = null, vahIdx = null, valIdx = null;
    let hoverText = '';
    let lastViewportKey = null;
    let renderedOnce = false;

    let lastMyTs = 0;
    const GAP_KEEP_MS = 120;

    let profileYMin = null;
    let profileYMax = null;
    let binYBounds = [];

    function updateMenuText() {
      const u = chartCore?.indicators?.get?.('vpvr')?.domU;
      if (u) u.innerHTML = hoverText ? `<s>${hoverText}</s>` : '';
    }

    function splitCandleVolume(c) {
      const v = Number(c?.volume) || 0;
      if (c.close > c.open) return { up: v, down: 0 };
      if (c.close < c.open) return { up: 0, down: v };
      const half = v / 2;
      return { up: half, down: half };
    }

    function makeViewportKey(L) {
      return [
        Math.round(L.plotX),
        Math.round(L.plotW),
        Math.round(L.offsetX),
        Math.round(L.scaleX * 100),
        Math.round(L.scaleY * 100),
        Math.round(L.offsetY),
        rows,
        L.tfMs
      ].join('|');
    }

    function calculate(candles, L) {
      const denom = L.spacing * L.scaleX;
      if (!Number.isFinite(denom) || denom === 0 || !candles?.length || rows <= 0) return [];

      const start = Math.max(0, Math.floor((L.plotX - L.offsetX) / denom));
      const end = Math.min(candles.length - 1, Math.ceil((L.plotX + L.plotW - L.offsetX) / denom) - 1);
      const slice = candles.slice(start, end + 1);
      const minPrice = Math.min(...slice.map(c => c.low));
      const maxPrice = Math.max(...slice.map(c => c.high));
      if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice === maxPrice) return [];

      const step = (maxPrice - minPrice) / rows;
      const upBins = Array(rows).fill(0);
      const downBins = Array(rows).fill(0);

      for (const c of slice) {
        const { up, down } = splitCandleVolume(c);
        const lo = Math.floor((c.low - minPrice) / step);
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

      const result = upBins.map((u, i) => {
        const d = downBins[i];
        return {
          priceLow: minPrice + i * step,
          priceHigh: minPrice + (i + 1) * step,
          up: u,
          down: d,
          total: u + d
        };
      });

      pocIdx = result.reduce((maxIdx, p, i) => p.total > result[maxIdx].total ? i : maxIdx, 0);

      if (result.length && vahval) {
        const total = result.reduce((a, p) => a + p.total, 0);
        const target = total * 0.7;
        let acc = 0;
        const sorted = [...result].sort((a, b) => b.total - a.total);
        const included = [];
        for (const p of sorted) { if (acc >= target) break; acc += p.total; included.push(p); }
        const minLow = Math.min(...included.map(p => p.priceLow));
        const maxHigh = Math.max(...included.map(p => p.priceHigh));
        valIdx = result.findIndex(p => p.priceLow <= minLow && p.priceHigh > minLow);
        vahIdx = result.findIndex(p => p.priceLow < maxHigh && p.priceHigh >= maxHigh);
      }

      return result;
    }

    function render(L) {
      const candles = L?.candles;
      if (!candles?.length) return;

      const key = makeViewportKey(L);
      if (key !== lastViewportKey) {
        profile = calculate(candles, L);
        lastViewportKey = key;
        hoverText = '';
        lastMyTs = 0;
        updateMenuText();
      }

      if (!profile.length) {
        bars.clear(); pocLine.clear(); vahvalLines.clear();
        hoverText = '';
        updateMenuText();
        return;
      }

      const first = profile[0];
      const last = profile[profile.length - 1];
      profileYMin = L.priceToY(last.priceHigh);
      profileYMax = L.priceToY(first.priceLow);
      console.log('[VPVR] диапазон профиля:',
        'minPrice=', first.priceLow,
        'maxPrice=', last.priceHigh,
        'yMin=', profileYMin,
        'yMax=', profileYMax
      );

      bars.clear(); pocLine.clear(); vahvalLines.clear();
      renderedOnce = true;

      const plotX = L.plotX, plotW = L.plotW, width = vpvr.meta.width;
      const yFromPrice = (price) => L.priceToY(price);
      const baseX = (side === 'right') ? (plotX + plotW) : plotX;
      const maxTotal = Math.max(...profile.map(p => p.total)) || 1;

      binYBounds = new Array(profile.length);

      for (let i = 0; i < profile.length; i++) {
        const p = profile[i];
        const yTop = yFromPrice(p.priceHigh);
        const yBot = yFromPrice(p.priceLow);

        const top = Math.min(yTop, yBot);
        const bot = Math.max(yTop, yBot);
        binYBounds[i] = { top, bot };

        const height = Math.max(1, Math.abs(yBot - yTop) - 2);
        const yMid = (yTop + yBot) / 2;
        const y = yMid - height / 2;

        const inVA = vahval && vahIdx != null && valIdx != null && i >= valIdx && i <= vahIdx;
        const baseColor = inVA ? downColor : downColorDim;
        const insertColor = inVA ? upColor : upColorDim;

        const lenTotal = (p.total / maxTotal) * width;
        const lenUp = (p.up / maxTotal) * width;

        bars.beginFill(baseColor, 1);
        if (side === 'right') {
          if (direction === 'inward') bars.drawRect(baseX - lenTotal, y, lenTotal, height);
          else bars.drawRect(baseX, y, lenTotal, height);
        } else {
          if (direction === 'inward') bars.drawRect(baseX, y, lenTotal, height);
          else bars.drawRect(baseX - lenTotal, y, lenTotal, height);
        }
        bars.endFill();

        if (lenUp > 0) {
          bars.beginFill(insertColor, 1);
          if (side === 'right') {
            if (direction === 'inward') {
              bars.drawRect(baseX - lenUp, y, lenUp, height);
            } else {
              bars.drawRect(baseX, y, lenUp, height);
            }
          } else {
            if (direction === 'inward') {
              bars.drawRect(baseX, y, lenUp, height);
            } else {
              bars.drawRect(baseX - lenUp, y, lenUp, height);
            }
          }
          bars.endFill();
        }
      }

      if (pocIdx != null && pocColor != null) {
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

        if (vahColor != null) {
          vahvalLines.moveTo(plotX, vahY);
          vahvalLines.lineTo(plotX + plotW, vahY);
          vahvalLines.stroke({ width: vahvalLineWidth, color: vahColor });
        }

        if (valColor != null) {
          vahvalLines.moveTo(plotX, valY);
          vahvalLines.lineTo(plotX + plotW, valY);
          vahvalLines.stroke({ width: vahvalLineWidth, color: valColor });
        }
      }
    }

    function updateHover(candle, idx, extra) {
      if (!renderedOnce || !profile?.length) {
        hoverText = '';
        updateMenuText();
        return;
      }

      if (extra?.my == null) {
        if (Date.now() - lastMyTs < GAP_KEEP_MS) {
          updateMenuText();
          return;
        } else {
          hoverText = '';
          updateMenuText();
          return;
        }
      }

      lastMyTs = Date.now();

      // проверка попадания курсора в актуальный диапазон профиля по Y
      if (profileYMin != null && profileYMax != null) {
        if (extra.my < profileYMin || extra.my > profileYMax) {
          hoverText = '';
          updateMenuText();
          return;
        }
      }

      const my = extra.my;
      let binIndex = -1;
      for (let i = 0; i < binYBounds.length; i++) {
        const b = binYBounds[i];
        if (my >= b.top && my <= b.bot) {
          binIndex = i;
          break;
        }
      }

      if (binIndex < 0) {
        hoverText = '';
        updateMenuText();
        return;
      }

      const p = profile[binIndex];
      if (!p || p.total <= 0) {
        hoverText = '';
        updateMenuText();
        return;
      }

      const delta = p.up - p.down;
      const pct = p.total > 0 ? (delta / p.total) * 100 : 0;
      const sign = delta >= 0 ? '+' : '';

      hoverText = `B:${p.up.toFixed(2)} S:${p.down.toFixed(2)} Δ:${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(1)}%)`;
      updateMenuText();
    }

    return {
      render,
      calculate: () => profile,
      values: profile,
      updateHover
    };
  }
};
