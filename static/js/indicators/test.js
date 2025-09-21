export const meta = {
  id: "test",
  name: "Test Indicator",
  type: "line",
  position: "overlay", // поверх графика
  color: 0xff0000,
  zIndex: 100
};

export function createIndicator({ layer }, layout) {
  const g = new PIXI.Graphics();
  layer.addChild(g);

  function render(L) {
    g.clear();
    if (!L?.candles?.length) return;

    g.lineStyle(2, meta.color);

    const cw = (L.config.candleWidth + L.config.spacing) * L.scaleX;
    const midY = L.height / 2;

    L.candles.forEach((c, i) => {
      const x = i * cw + L.offsetX + (L.config.candleWidth * L.scaleX) / 2;
      if (i === 0) g.moveTo(x, midY);
      else g.lineTo(x, midY);
    });
  }

  return { layer, render };
}
