export const volume = {
  meta: {
    id: 'volume',
    name: 'Volume',
    position: 'overlay',   // поверх графика, прижат к низу plot
    zIndex: 20,
    defaultParams: {
      upColor: 0x00ff00,   // зелёный
      downColor: 0xff3b3b, // красный
      height: 80,          // высота блока объёмов
      autoheight: true
    }
  },

  createIndicator({ layer }, layout, params = {}) {
    const upColor   = params.upColor   ?? volume.meta.defaultParams.upColor;
    const downColor = params.downColor ?? volume.meta.defaultParams.downColor;
    const volH      = params.height    ?? volume.meta.defaultParams.height;

    const g = new PIXI.Graphics();
    g.zIndex = volume.meta.zIndex;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    let lastMaxVolVisible = 1;
    let lastCandlesKey = null;

    function render(layout) {
      const { candles, indexToX, plotH, candleWidth, scaleX, plotW } = layout;
      if (!candles?.length) return;

      // ключ для сброса кэша
      const candlesKey = `${candles.length}_${candles[0]?.time}_${candles[candles.length - 1]?.time}`;
      if (candlesKey !== lastCandlesKey) {
        lastMaxVolVisible = Math.max(...candles.map(c => c.volume || 0));
        lastCandlesKey = candlesKey;
      }

      const baseY = plotH - volH;
      const barWidth = candleWidth * scaleX;

      g.clear();

      const safeBarWidth = Math.max(1, barWidth);
      const barsOnScreen = plotW / safeBarWidth;

      // авто‑масштаб с плавным сглаживанием
      let visibleMax = 0;
      for (let i = 0; i < candles.length; i++) {
        const xCenter = indexToX(i);
        const xLeft = xCenter - barWidth / 2;
        const xRight = xCenter + barWidth / 2;
        if (xRight >= 0 && xLeft <= plotW) {
          const v = candles[i].volume || 0;
          if (v > visibleMax) visibleMax = v;
        }
      }
      let maxVol = visibleMax || 1;
      const alpha = 0.3;
      lastMaxVolVisible = lastMaxVolVisible * (1 - alpha) + maxVol * alpha;
      maxVol = lastMaxVolVisible;

      // --- LOD ---
      if (barsOnScreen < 800) {
        // 🔹 близко — группируем по цветам
        g.beginFill(upColor);
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          if (c.close >= c.open) {
            const x = indexToX(i) - barWidth / 2;
            let h = (c.volume / maxVol) * volH;
            h = Math.max(0, Math.min(volH, h));
            const y = baseY + (volH - h);
            g.drawRect(x, y, barWidth, h);
          }
        }
        g.endFill();

        g.beginFill(downColor);
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          if (c.close < c.open) {
            const x = indexToX(i) - barWidth / 2;
            let h = (c.volume / maxVol) * volH;
            h = Math.max(0, Math.min(volH, h));
            const y = baseY + (volH - h);
            g.drawRect(x, y, barWidth, h);
          }
        }
        g.endFill();

      } else if (barsOnScreen < 2000) {
        // 🔹 средне — тонкие бары
        const thinWidth = Math.max(1, Math.min(2, barWidth));
        g.beginFill(upColor);
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          if (c.close >= c.open) {
            const x = indexToX(i) - thinWidth / 2;
            let h = (c.volume / maxVol) * volH;
            h = Math.max(0, Math.min(volH, h));
            const y = baseY + (volH - h);
            g.drawRect(x, y, thinWidth, h);
          }
        }
        g.endFill();

        g.beginFill(downColor);
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          if (c.close < c.open) {
            const x = indexToX(i) - thinWidth / 2;
            let h = (c.volume / maxVol) * volH;
            h = Math.max(0, Math.min(volH, h));
            const y = baseY + (volH - h);
            g.drawRect(x, y, thinWidth, h);
          }
        }
        g.endFill();

      } else {
        // 🔹 далеко — линия
        g.lineStyle(1, 0x888888, 1);
        let first = true;
        const step = Math.max(1, Math.ceil(candles.length / plotW));
        for (let i = 0; i < candles.length; i += step) {
          const c = candles[i];
          const x = indexToX(i);
          let h = (c.volume / maxVol) * volH;
          h = Math.max(0, Math.min(volH, h));
          const y = baseY + (volH - h);
          if (first) { g.moveTo(x, y); first = false; }
          else { g.lineTo(x, y); }
        }
        g.lineStyle(0);
      }
    }

    return { render };
  }
};
