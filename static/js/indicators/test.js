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
        g.beginFill(0x222222)
         .drawRect(0, 0, localLayout.plotW, localLayout.plotH)
         .endFill();
        layer.addChild(g);

        // Overlay — используем глобальные координаты
        overlayMgr.ensureOverlay(
          'test',
          'Test Indicator',
          100,
          () => 500,
          { showPar: true, showVal: true }
        );
        overlayMgr.updateOverlayBox('test', globalLayout);
      },
      destroy() {
        layer.removeChildren();
        overlayMgr.removeOverlay('test');
      }
    };
  }
};
