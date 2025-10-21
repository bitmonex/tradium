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
          true
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
