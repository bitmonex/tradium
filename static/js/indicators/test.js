// indicators/test.js
export const test = {
  meta: {
    id: 'test',
    name: 'Test Indicator',
    position: 'bottom',
    height: 100,
    zIndex: 10
  },

  createIndicator({ layer, chartCore }) {
    const overlayMgr = chartCore.overlayMgr;

    return {
      render(localLayout, globalLayout) {
        // очищаем слой
        layer.removeChildren();

        // фон
        const g = new PIXI.Graphics();
        g.beginFill(0x1C1C1C)
         .drawRect(0, 0, localLayout.plotW, localLayout.plotH)
         .endFill();
        layer.addChild(g);

        // создаём overlay (с параметром par)
        overlayMgr.ensureOverlay(
          'test',
          'Test Indicator',
          '50/200',
          { showPar: true, showVal: true }
        );

        // обновляем значение (val) с HTML
        overlayMgr.updateValue(
          'test',
          `
            <i><b>Buy</b> 369k</i>
            <i><b>Sell</b> 35k</i>
            <i><b>Depth</b> 260k</i>
            <i><b>Ratio</b> 0.54</i>
          `,
          true // говорим, что это HTML
        );

        // позиционируем overlay в пределах подграфика
        overlayMgr.updateOverlayBox('test', globalLayout);
      },

      destroy() {
        layer.removeChildren();
        overlayMgr.removeOverlay('test');
      }
    };
  }
};
