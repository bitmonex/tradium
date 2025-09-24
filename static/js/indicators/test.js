// indicators/test.js
export const test = {
  meta: {
    id: 'test',
    name: 'Test Indicator',
    position: 'bottom',
    height: 70,
    zIndex: 10
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0x333333, 0.5) // зелёный
         .drawRect(0, 0, layout.plotW, meta.height)
         .endFill();
        layer.addChild(g);
      }
    };
  }
};

export const test2 = {
  meta: {
    id: 'test2',
    name: 'Test Indicator 2',
    position: 'bottom',
    height: 70,
    zIndex: 11
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0x1B1626) // синий
         .drawRect(0, 0, layout.plotW, meta.height)
         .endFill();
        layer.addChild(g);
      }
    };
  }
};

export const test3 = {
  meta: {
    id: 'test3',
    name: 'Test Indicator 3',
    position: 'bottom',
    height: 70,
    zIndex: 12
  },
  createIndicator({ layer }) {
    return {
      render(layout, meta) {
        layer.removeChildren();
        const g = new PIXI.Graphics();
        g.beginFill(0x1F1616) // красный
         .drawRect(0, 0, layout.plotW, meta.height)
         .endFill();
        layer.addChild(g);
      }
    };
  }
};
