export const test3 = {
  meta: {
    position: 'bottom', // блочный индикатор
    height: 70,         // высота блока в пикселях
    zIndex: 12
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0x800080, 0.5) // фиолетовый фон с прозрачностью
         .drawRect(0, 0, layout.plotW, meta.height)
         .endFill();
        layer.addChild(g);
      }
    };
  }
};
