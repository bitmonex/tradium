// chart-indicators.js
import { Indicators } from './indicators/index.js';

export function createIndicatorsManager(chartCore) {
  const active = new Map(); // id -> { meta, instance }

  function add(id) {
    if (active.has(id) || !Indicators[id]) return;
    const def = Indicators[id];
    const layer = new PIXI.Container();
    layer.zIndex = def.meta.zIndex ?? 50;
    chartCore.group.addChild(layer);
    const instance = def.createIndicator({ layer, chartCore }, chartCore.layout);
    active.set(id, { meta: def.meta, instance, layer });
  }

  function remove(id) {
    const obj = active.get(id);
    if (!obj) return;
    chartCore.group.removeChild(obj.layer);
    obj.layer.destroy({ children: true });
    active.delete(id);
  }

  function renderAll(layout) {
    for (const { instance } of active.values()) {
      instance.render?.(layout);
    }
  }

  function initFromConfig(configList) {
    configList.forEach(id => add(id));
  }

  return { add, remove, renderAll, initFromConfig };
}
