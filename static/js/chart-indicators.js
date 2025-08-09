export function Indicators({ group, app, config, candles }) {
  const activeIndicators = {};

  function add(id, layout) {
    const mod = IndicatorModules[id];
    if (!mod) return;
    if (activeIndicators[id]) return;

    const layer = new PIXI.Container();
    group.addChild(layer);

    const result = mod.createIndicator({}, layout, candles);

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
