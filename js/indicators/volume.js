// volume.js
export const volume = {
  meta: {
    id: 'volume',
    name: 'Volume',
    position: 'overlay',   // поверх графика
    zIndex: 40,
    height: 100,
    defaultParams: {
      upColor: 0x00ff00,   // зелёный
      downColor: 0xff0000, // красный
      neutralColor: 0x999999
    }
  },
  createIndicator({ layer }, layout, params = {}) {
    const upColor      = params.upColor      ?? volume.meta.defaultParams.upColor;
    const downColor    = params.downColor    ?? volume.meta.defaultParams.downColor;
    const neutralColor = params.neutralColor ?? volume.meta.defaultParams.neutralColor;
    const bars = new PIXI.Graphics();
    layer.addChild(bars);
    function render(currentLayout) {
      const candles = currentLayout.candles;
      if (!candles?.length) return;
      bars.clear();
      const cw       = (currentLayout.config.candleWidth + currentLayout.config.spacing) * currentLayout.scaleX;
      const usableW  = currentLayout.usableW ?? currentLayout.plotW;
      const maxVol   = Math.max(...candles.map(c => c.volume || 0)) || 1;
      // высота блока объёмов
      const volH = volume.meta.height;
      // прижимаем к нижней границе графика
      const baseY = currentLayout.plotH - volH;
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = i * cw + currentLayout.offsetX;
        if (x > usableW) break;
        const h = (c.volume / maxVol) * volH;
        const y = baseY + (volH - h);
        let color = neutralColor;
        if (c.close > c.open) color = upColor;
        else if (c.close < c.open) color = downColor;
        bars.beginFill(color);
        bars.drawRect(x, y, currentLayout.config.candleWidth * currentLayout.scaleX, h);
        bars.endFill();
      }
    }
    return { render };
  }
};