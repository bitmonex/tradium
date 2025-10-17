// indicators/volume.js
export const volume = {
  meta: {
    id: 'volume',
    name: 'Volume',
    position: 'overlay',   // поверх графика, прижат к низу plot
    zIndex: 20,
    params: {
      upColor: 0x00ff00,   // зелёный
      downColor: 0xff3b3b  // красный
    },
    height: 80,           // высота блока объёмов
    autoheight: true       // автоподгон по видимым барам
  },

  createIndicator({ layer }) {
    const g = new PIXI.Graphics();
    g.zIndex = 20;
    g.visible = true;
    layer.sortableChildren = true;
    layer.addChild(g);

    // кэш для стабильности autoheight
    let lastMaxVolVisible = 1;
    let lastCandlesKey = null; // 🔹 отслеживаем смену данных

    function render(layout) {
      const {
        candles,
        indexToX,
        plotH,
        candleWidth,
        scaleX,
        plotW
      } = layout;

      if (!candles?.length) return;

      // 🔹 формируем ключ по данным (кол-во + время первой и последней свечи)
      const candlesKey = `${candles.length}_${candles[0]?.time}_${candles[candles.length - 1]?.time}`;
      if (candlesKey !== lastCandlesKey) {
        // новые данные → сброс кэша и пересчёт
        lastMaxVolVisible = 1;
        lastCandlesKey = candlesKey;
      }

      const { upColor, downColor } = volume.meta.params;
      const volH = volume.meta.height;
      const baseY = plotH - volH;
      const barWidth = candleWidth * scaleX;

      g.clear();

      let maxVol;
      if (volume.meta.autoheight) {
        let visibleMax = 0;
        for (let i = 0; i < candles.length; i++) {
          const xCenter = indexToX(i);
          const xLeft = xCenter - barWidth / 2;
          const xRight = xCenter + barWidth / 2;
          // бар считается видимым, если пересекает экран [0, plotW]
          if (xRight >= 0 && xLeft <= plotW) {
            const v = candles[i].volume || 0;
            if (v > visibleMax) visibleMax = v;
          }
        }

        if (visibleMax > 0) {
          // если это первый рендер после смены данных → берём сразу без сглаживания
          if (lastMaxVolVisible === 1) {
            lastMaxVolVisible = visibleMax;
          } else {
            const alpha = 0.3; // сглаживание при скролле/зуме
            lastMaxVolVisible =
              lastMaxVolVisible * (1 - alpha) + visibleMax * alpha;
          }
          maxVol = lastMaxVolVisible;
        } else {
          // если ничего видимого — fallback на глобальный максимум
          maxVol = Math.max(...candles.map(c => c.volume || 0)) || 1;
        }
      } else {
        // глобальный режим
        maxVol = Math.max(...candles.map(c => c.volume || 0)) || 1;
      }

      // рисуем бары
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = indexToX(i) - barWidth / 2;

        let h = (c.volume / maxVol) * volH;
        if (h > volH) h = volH;
        if (h < 0) h = 0;

        const y = baseY + (volH - h);
        const color = c.close >= c.open ? upColor : downColor;

        g.beginFill(color);
        g.drawRect(x, y, barWidth, h);
        g.endFill();
      }
    }

    return { render };
  }
};
