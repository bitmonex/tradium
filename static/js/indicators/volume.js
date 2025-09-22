export const meta = {
  id: "volume",
  name: "Объём",
  type: "bar",
  position: "bottom",   // под графиком
  height: 60,           // высота области объёмов
  zIndex: 5
};

export function createIndicator({ layer }, layout) {
  const bars = [];

  function render(L) {
    const history = L.candles;
    if (!history?.length) return;

    const maxVol = Math.max(...history.map(c => c.volume || 0)) || 1;
    const cw = (L.config.candleWidth + L.config.spacing) * L.scaleX;
    const barWidth = Math.max(L.config.candleWidth * L.scaleX, 1);

    // Зона объёмов: низ = вся высота канвы, верх = низ минус высота индикатора
    const volTop = L.height - meta.height;
    const volBottom = L.height;

    // Оптимизация: рендерим только видимые бары
    const startIdx = Math.max(0, Math.floor((-L.offsetX) / cw) - 2);
    const endIdx = Math.min(history.length, Math.ceil((L.width - L.config.rightOffset - L.offsetX) / cw) + 2);

    // Создаём недостающие графические объекты
    while (bars.length < history.length) {
      const bar = new PIXI.Graphics();
      layer.addChild(bar);
      bars.push(bar);
    }

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (i < startIdx || i > endIdx) {
        bar.visible = false;
        continue;
      }

      const c = history[i];
      const x = i * cw + L.offsetX;
      const h = (c.volume / maxVol) * meta.height;
      const color = c.close >= c.open ? L.config.candleBull : L.config.candleBear;

      bar.clear();
      bar.visible = true;
      bar.rect(x, volBottom - h, barWidth, h).fill(color);
    }
  }

  return { layer, render };
}
