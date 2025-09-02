//chart-indicators.js
import { Indicators as defs } from './indicators/index.js';

export function Indicators({ group, config }) {
  const layer = new PIXI.Container();
  layer.zIndex = 15;
  group.addChild(layer);
  const instances = [];
  function initOne(id, mod, layout) {
    if (!config.modules.indicators) return;
    if (typeof mod.createIndicator !== 'function') return;
    if (!layout?.candles?.length) return;
    try {
      const params = mod.params || {};
      const inst = mod.createIndicator({ layer }, layout, params);

      if (inst && typeof inst.render === 'function') {
        instances.push(inst);
      }
    } catch (err) {
      console.warn(`⚠️ Indicator "${id}" init failed:`, err);
    }
  }
  function add(layout) {
    if (instances.length) return;
    for (const [id, mod] of Object.entries(defs)) {
      initOne(id, mod, layout);
    }
  }
  function render(layout) {
    for (const inst of instances) {
      try {
        inst.render(layout);
      } catch (err) {
        console.warn('⚠️ Indicator render failed:', err);
      }
    }
  }
  return { add, render };
}
