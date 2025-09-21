export const meta = {
  id: "test",
  name: "Test Indicator",
  type: "debug",
  position: "overlay",
  zIndex: 9999
};

export function createIndicator({ layer }, layout) {
  const g = new PIXI.Graphics();
  layer.addChild(g);

  function render(L) {
    g.clear();

    // Полупрозрачный фон внутри области графика
    g.beginFill(0x00ff00, 0.1);
    g.drawRect(L.plotX, L.plotY, L.plotW, L.plotH);
    g.endFill();

    // Горизонтальная линия по центру
    g.lineStyle(3, 0xff0000, 1);
    const midY = L.plotY + L.plotH / 2;
    g.moveTo(L.plotX, midY);
    g.lineTo(L.plotX + L.plotW, midY);

    // Вертикальные линии по краям видимой области
    g.lineStyle(2, 0x0000ff, 1);
    g.moveTo(L.plotX, L.plotY);
    g.lineTo(L.plotX, L.plotY + L.plotH);

    g.moveTo(L.plotX + L.plotW, L.plotY);
    g.lineTo(L.plotX + L.plotW, L.plotY + L.plotH);

    // Текст с отладкой
    const style = new PIXI.TextStyle({ fill: "#ffffff", fontSize: 14 });
    const text = new PIXI.Text(`DEBUG: ${L.candles.length} candles`, style);
    text.x = L.plotX + 10;
    text.y = L.plotY + 10;
    g.addChild(text);
  }

  return { layer, render };
}
