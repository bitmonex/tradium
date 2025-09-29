//chart-indicators.js
import { Indicators } from './indicators/index.js';

export function createIndicatorsManager(chartCore) {
  const active = new Map();
  const menu = document.querySelector(".m-indicators");
  const switcher = menu?.querySelector(".switcher");

  function renderDOM(id) {
    if (!menu) return;
    const span = document.createElement("span");
    span.setAttribute("data-indicator", id);

    const title = document.createElement("strong");
    title.textContent = id.toUpperCase();
    span.appendChild(title);

    const view = document.createElement("i");
    view.innerHTML = `<b class="icon-view"></b>`;
    view.addEventListener("click", () => {
      const obj = active.get(id);
      if (!obj) return;
      const visible = obj.layer.visible;
      obj.layer.visible = !visible;
      const icon = view.querySelector("b");
      icon.className = visible ? "icon-view-off" : "icon-view";
    });
    span.appendChild(view);

    const settings = document.createElement("i");
    settings.innerHTML = `<b class="icon-settings"></b>`;
    settings.addEventListener("click", () => {
      const event = new CustomEvent("indicator-settings", { detail: { id } });
      window.dispatchEvent(event);
    });
    span.appendChild(settings);

    const del = document.createElement("i");
    del.innerHTML = `<b class="icon-delete"></b>`;
    del.addEventListener("click", () => {
      remove(id);
    });
    span.appendChild(del);

    menu.appendChild(span);
    menu.classList.add("on");
  }

  function removeDOM(id) {
    const el = menu?.querySelector(`[data-indicator="${id}"]`);
    if (el) el.remove();
    if (menu && menu.querySelectorAll("span").length === 0) {
      menu.classList.remove("on");
    }
  }

  function add(id) {
    if (active.has(id)) return;

    const def = Indicators[id];
    if (!def?.meta || typeof def.createIndicator !== 'function') {
      console.warn(`[IndicatorsManager] Индикатор ${id} некорректный`);
      return;
    }

    const layer = new PIXI.Container();
    layer.zIndex = def.meta.zIndex ?? 50;

    const parent = def.meta.position === 'bottom'
      ? chartCore.state.subGroup
      : chartCore.state.graphGroup;

    if (def.meta.position === 'bottom') {
      const offsetY = Array.from(active.values())
        .filter(v => v.meta.position === 'bottom')
        .reduce((sum, v) => sum + (v.meta.height || 0), 0);
      layer.y = offsetY;
    }

    parent.addChild(layer);
    const instance = def.createIndicator({ layer, chartCore }, chartCore.layout);
    active.set(id, { meta: def.meta, instance, layer });

    renderDOM(id);
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

    removeDOM(id);
    window.dispatchEvent(new CustomEvent("indicator-removed", { detail: { id } }));
  }

  function renderAll(layout) {
    if (chartCore?.state?.subGroup && layout?.plotH != null) {
      chartCore.state.subGroup.y = layout.plotH;
    }
    for (const { instance, meta, layer } of active.values()) {
      instance.render?.(layout, meta, layer);
    }
  }

function initFromConfig(list) {
  console.log("[IndicatorsManager] initFromConfig called", list);
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

  function isActive(id) {
    return active.has(id);
  }

  // визуальное сворачивание меню
  switcher?.addEventListener("click", () => {
    menu.classList.toggle("min");
    const icon = switcher.querySelector("b");
    icon.classList.toggle("icon-on");
    icon.classList.toggle("icon-off");
  });

  return { add, remove, renderAll, initFromConfig, destroy, getBottomStackHeight, isActive };
}
