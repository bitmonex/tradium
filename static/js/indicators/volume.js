//Indicators | Volume
export const meta = {
  id: "volume",
  name: "Объём",
  type: "bar",
  color: "#777777", // можно и 0x777777, Pixi v8 поймёт оба формата
  height: 100,
  bottomOffset: 30,
  rightOffset: 70
};

export function createIndicator({ layer }, layout) {
  const bars = [];

  function render(currentLayout) {
    const history = currentLayout.candles;
    if (!history?.length) return;

    const maxVol = Math.max(...history.map(c => c.volume || 0));
    const volHeight = meta.height;
    const width = currentLayout.width;
    const offsetX = currentLayout.offsetX;
    const scaleX = currentLayout.scaleX;
    const rawBarWidth = currentLayout.config.candleWidth * scaleX;
    const barWidth = Math.max(rawBarWidth, 1);
    const spacing = currentLayout.config.spacing * scaleX;
    const bottomY = currentLayout.height - meta.bottomOffset;

    // Создаём недостающие бары
    while (bars.length < history.length) {
      const bar = new PIXI.Graphics();
      layer.addChild(bar);
      bars.push(bar);
    }

    bars.forEach((bar, i) => {
      const c = history[i];
      const x = i * (rawBarWidth + spacing) + offsetX;
      const h = (c.volume / maxVol) * volHeight;

      bar.clear();

      if (x + barWidth < 0 || x > width - meta.rightOffset) {
        bar.visible = false;
        return;
      }

      bar.visible = true;
      // Новый API Pixi v8: rect + fill
      bar.rect(x, bottomY - h, barWidth, h).fill(meta.color);
    });
  }

  return { layer, render };
}
