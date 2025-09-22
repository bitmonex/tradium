// indicators/test.js
export const test = {
  meta: {
    position: 'bottom',
    height: 100,
    zIndex: 10
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0x00ff00, 0.5)
         .drawRect(0, 0, layout.plotW, meta.height) // ровно по высоте блока
         .endFill();
        layer.addChild(g);
      }
    };
  }
};
