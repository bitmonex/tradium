// chart-indicators.js
import { Indicators } from './indicators/index.js';

export function createIndicatorsManager(chartCore) {
  const active = new Map(); // id -> { meta, instance, layer }

  function add(id) {
    if (active.has(id)) {
      console.warn(`[IndicatorsManager] Индикатор ${id} уже активен`);
      return;
    }
    if (!Indicators[id]) {
      console.warn(`[IndicatorsManager] Индикатор ${id} не найден в index.js`);
      return;
    }
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
    if (!Array.isArray(configList) || !configList.length) return;
    configList.forEach(id => add(id));
  }

  function destroy() {
    for (const id of active.keys()) remove(id);
  }

  // Новый метод: суммарная высота всех bottom-индикаторов
  function getBottomStackHeight() {
    let total = 0;
    for (const { meta } of active.values()) {
      if (meta.position === 'bottom' && typeof meta.height === 'number') {
        total += meta.height;
      }
    }
    return total;
  }

  return { add, remove, renderAll, initFromConfig, destroy, getBottomStackHeight };
}
