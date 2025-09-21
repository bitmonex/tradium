// chart-indicators.js
import { Indicators } from './indicators/index.js';

export function createIndicatorsManager(chartCore) {
  //console.log('[IndicatorsManager] Создан менеджер индикаторов');

  const active = new Map(); // id -> { meta, instance }

  function add(id) {
    //console.log(`[IndicatorsManager] add(${id})`);
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
    //console.log(`[IndicatorsManager] Слой для ${id} добавлен в chartCore.group`);
    const instance = def.createIndicator({ layer, chartCore }, chartCore.layout);
    active.set(id, { meta: def.meta, instance, layer });
    //console.log(`[IndicatorsManager] Индикатор ${id} создан и активирован`);
  }

  function remove(id) {
    //console.log(`[IndicatorsManager] remove(${id})`);
    const obj = active.get(id);
    if (!obj) {
      console.warn(`[IndicatorsManager] Индикатор ${id} не найден среди активных`);
      return;
    }
    chartCore.group.removeChild(obj.layer);
    obj.layer.destroy({ children: true });
    active.delete(id);
    //console.log(`[IndicatorsManager] Индикатор ${id} удалён`);
  }

  function renderAll(layout) {
    //console.log(`[IndicatorsManager] renderAll() — активных: ${active.size}`);
    for (const [id, { instance }] of active.entries()) {
      //console.log(`  → рендер индикатора: ${id}`);
      instance.render?.(layout);
    }
  }

  function initFromConfig(configList) {
    //console.log('[IndicatorsManager] initFromConfig()', configList);
    if (!Array.isArray(configList) || !configList.length) {
      console.warn('[IndicatorsManager] Список индикаторов пуст или не массив');
      return;
    }
    configList.forEach(id => add(id));
  }

  function destroy() {
    //console.log('[IndicatorsManager] destroy()');
    for (const id of active.keys()) remove(id);
  }

  return { add, remove, renderAll, initFromConfig, destroy };
}
