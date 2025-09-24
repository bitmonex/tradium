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

    // Внешний контейнер для индикатора + наша линия
    const decor = new PIXI.Container();
    decor.zIndex = def.meta.zIndex ?? 50;
    decor.sortableChildren = true;

    // Внутренний контейнер, в который рендерит сам индикатор
    const content = new PIXI.Container();
    decor.addChild(content);

    const parent = def.meta.position === 'bottom'
      ? chartCore.state.subGroup
      : chartCore.state.graphGroup;

    if (def.meta.position === 'bottom') {
      // Смещение вниз для стека
      const offsetY = Array.from(active.values())
        .filter(v => v.meta.position === 'bottom')
        .reduce((sum, v) => sum + (v.meta.height || 0), 0);
      decor.y = offsetY;

      // Линия у верхнего края
      const line = new PIXI.Graphics();
      line.name = '__line';
      line.zIndex = 9999;
      decor.addChild(line);
    }

    parent.addChild(decor);

    // Индикатор рисует только в content
    const instance = def.createIndicator({ layer: content, chartCore }, chartCore.layout);
    active.set(id, { meta: def.meta, instance, decor, content });
  }

  function remove(id) {
    const obj = active.get(id);
    if (!obj) return;

    const parent = obj.meta.position === 'bottom'
      ? chartCore.state.subGroup
      : chartCore.state.graphGroup;

    parent.removeChild(obj.decor);

    // Полная очистка GPU‑ресурсов
    obj.decor.destroy({ children: true, texture: false, baseTexture: false });

    active.delete(id);
  }

  function renderAll(layout) {
    if (chartCore?.state?.subGroup && layout?.plotH != null) {
      chartCore.state.subGroup.y = layout.plotH;
    }

    for (const { instance, meta, decor, content } of active.values()) {
      instance.render?.(layout, meta, content);

      if (meta.position === 'bottom') {
        const line = decor.getChildByName('__line');
        if (line) {
          const y = 0; // верхний край
          const fullW = layout.plotW || 500; // подстраховка

          line.clear();
          line.moveTo(0, y);
          line.lineTo(fullW, y);
          line.stroke({ width: 0.3, color: 0x333333 });
        }
      }
    }
  }

  function initFromConfig(list) {
    if (Array.isArray(list)) list.forEach(add);
  }

  function destroy() {
    for (const id of active.keys()) remove(id);
  }

  function getBottomStackHeight() {
    return Array.from(active.values())
      .filter(v => v.meta.position === 'bottom')
      .reduce((sum, v) => sum + (v.meta.height || 0), 0);
  }

  return { add, remove, renderAll, initFromConfig, destroy, getBottomStackHeight };
}
