export const test2 = {
  meta: {
    position: 'bottom', // блочный индикатор
    height: 60,         // высота блока в пикселях
    zIndex: 11
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0xffff00, 0.5) // жёлтый фон с прозрачностью
         .drawRect(0, 0, layout.plotW, meta.height)
         .endFill();
        layer.addChild(g);
      }
    };
  }
};
