import { Indicators as IndicatorModules } from './indicators/index.js';

export function Indicators({ group, app, config, candles }) {
  const activeIndicators = {};

  function add(id, layout) {
    const mod = IndicatorModules[id];
    if (!mod || activeIndicators[id]) return;

    const layer = new PIXI.Container();
    layer.zIndex = 2000;
    group.addChild(layer);
    const result = mod.createIndicator({ layer, app }, layout, config.indicators?.params?.[id] || {});
    if (result?.layer && result?.render) {
      activeIndicators[id] = result;
    }
  }

  function render(layout) {
    for (const id in activeIndicators) {
      activeIndicators[id]?.render?.(layout);
    }
  }

  function init(layout) {
    if (config.indicators?.indicatorsEnabled) {
      for (const id of Object.keys(IndicatorModules)) {
        add(id, layout);
      }
    }
  }

  return { add, render, init };
}
