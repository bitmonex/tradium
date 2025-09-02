export const meta = {
  id: "volume",
  name: "Объём",
  type: "bar",
  color: "#777777",
  height: 100,
  bottomOffset: 30,
  rightOffset: 70
};

export const params = {
  color: meta.color,
  height: meta.height
};

export function createIndicator({ layer }, layout, params = {}) {
  // ждём, пока есть куда рисовать и появятся свечи
  if (!layer || !layout?.candles?.length) return;

  const bars = [];

  function render(currentLayout) {
    const history = currentLayout.candles;
    if (!history?.length) return;

    const maxVol     = Math.max(...history.map(c => c.volume || 0));
    const volHeight  = params.height;
    const width      = currentLayout.width;
    const offsetX    = currentLayout.offsetX;
    const scaleX     = currentLayout.scaleX;
    const rawBarW    = currentLayout.config.candleWidth * scaleX;
    const barW       = Math.max(rawBarW, 1);
    const spacing    = currentLayout.config.spacing * scaleX;
    const bottomY    = currentLayout.height - meta.bottomOffset;
    const colorHex   = PIXI.utils.string2hex(params.color);

    // создаём недостающие бары
    while (bars.length < history.length) {
      const bar = new PIXI.Graphics();
      layer.addChild(bar);
      bars.push(bar);
    }

    bars.forEach((bar, i) => {
      const c = history[i];
      const x = i * (rawBarW + spacing) + offsetX;
      const h = (c.volume / maxVol) * volHeight;

      bar.clear();

      if (x + barW < 0 || x > width - meta.rightOffset) {
        bar.visible = false;
        return;
      }

      bar.visible = true;
      bar.beginFill(colorHex);
      bar.drawRect(x, bottomY - h, barW, h);
      bar.endFill();
    });
  }

  return { layer, render };
}
