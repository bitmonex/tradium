// chart-indicators.js
import { Indicators } from './indicators/index.js';

export function createIndicatorsManager(chartCore) {
  const active = new Map();

  function add(id) {
    if (active.has(id)) return;

    const def = Indicators[id];
    if (!def?.meta || typeof def.createIndicator !== 'function') {
      console.warn(`[IndicatorsManager] Индикатор ${id} некорректный`);
      return;
    }

    const layer = new PIXI.Container();
    layer.zIndex = def.meta.zIndex ?? 50;

    // Куда добавлять слой
    const parent = def.meta.position === 'bottom'
      ? chartCore.state.subGroup
      : chartCore.state.graphGroup;

    // Если индикатор нижний — смещаем его слой на накопленную высоту уже добавленных нижних индикаторов
    if (def.meta.position === 'bottom') {
      const offsetY = Array.from(active.values())
        .filter(v => v.meta.position === 'bottom')
        .reduce((sum, v) => sum + (v.meta.height || 0), 0);
      layer.y = offsetY;
    }

    parent.addChild(layer);

    const instance = def.createIndicator({ layer, chartCore }, chartCore.layout);
    active.set(id, { meta: def.meta, instance, layer });
  }

  function remove(id) {
    const obj = active.get(id);
    if (!obj) return;
    const parent = obj.meta.position === 'bottom'
      ? chartCore.state.subGroup
      : chartCore.state.graphGroup;
    parent.removeChild(obj.layer);
    obj.layer.destroy({ children: true });
    active.delete(id);
  }

  function renderAll(layout) {
    // Смещаем нижнюю группу под текущую высоту графика
    if (chartCore?.state?.subGroup && layout?.plotH != null) {
      chartCore.state.subGroup.y = layout.plotH;
    }
    for (const { instance, meta, layer } of active.values()) {
      instance.render?.(layout, meta, layer);
    }
  }

  function initFromConfig(list) {
    if (!Array.isArray(list) || !list.length) return;
    list.forEach(id => add(id));
  }

  function destroy() {
    for (const id of active.keys()) remove(id);
  }

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
