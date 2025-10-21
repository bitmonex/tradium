// chart-indicators.js
import { Indicators } from './indicators/index.js';
import { createOverlayManager } from './indicators/overlay.js';

export function createIndicatorsManager(chartCore) {
  if (!chartCore.config.modules?.indicators) {
    console.warn('[IndicatorsManager] модуль индикаторов выключен');
    return {
      add: () => {},
      remove: () => {},
      renderAll: () => {},
      initFromConfig: () => {},
      destroy: () => {},
      reset: () => {},
      getBottomStackHeight: () => 0,
      isActive: () => false,
      activeKeys: () => [],
      enterFullscreen: () => {},
      exitFullscreen: () => {},
      toggleFullscreen: () => {},
      updateHoverAll: () => {}
    };
  }

  const active = new Map();
  let resizeState = null;

  if (!chartCore.overlayMgr) {
    chartCore.overlayMgr = createOverlayManager(chartCore);
  }
  const overlayMgr = chartCore.overlayMgr;
  const menu = document.querySelector('.m-indicators');

  const storageKey = `indicators_${chartCore.chartId}`;
  const fullscreenKey = `indicators_fullscreen_${chartCore.chartId}`;
  let fullscreenMode = false;

  // --- сохранение/загрузка ---
  function saveToStorage() {
    const data = {};
    for (const [id, obj] of active.entries()) {
      data[id] = {
        hiddenByEye: !!obj.hiddenByEye,
        height: obj.height ?? obj.meta.height ?? 100
      };
    }
    localStorage.setItem(storageKey, JSON.stringify(data));
  }
  function loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  }
  function saveFullscreen() {
    localStorage.setItem(fullscreenKey, JSON.stringify(fullscreenMode));
  }
  function loadFullscreen() {
    try {
      return JSON.parse(localStorage.getItem(fullscreenKey) || 'false');
    } catch {
      return false;
    }
  }

  // --- переключатель меню ---
  function bindMenuSwitcher() {
    const menu = document.querySelector('.m-indicators');
    const switcher = menu?.querySelector('.switcher');
    if (!switcher) return;

    const switcherKey = `indicators_menu_${chartCore.chartId}`;
    const newSwitcher = switcher.cloneNode(true);
    switcher.replaceWith(newSwitcher);

    const icon = newSwitcher.querySelector('b');
    const saved = localStorage.getItem(switcherKey);
    if (saved === 'off') {
      menu.classList.add('min');
      if (icon) icon.className = 'icon-off';
    } else {
      if (icon) icon.className = 'icon-on';
    }

    newSwitcher.addEventListener('click', () => {
      const collapsed = menu.classList.toggle('min');
      if (icon) icon.className = collapsed ? 'icon-off' : 'icon-on';
      localStorage.setItem(switcherKey, collapsed ? 'off' : 'on');
    });
  }

  // --- DOM меню ---
  function renderDOM(id) {
    if (!menu) return;
    if (menu.querySelector(`[data-indicator="${id}"]`)) return;

    const span = document.createElement('span');
    span.setAttribute('data-indicator', id);

    const title = document.createElement('strong');
    title.textContent = id.toUpperCase();
    span.appendChild(title);

    const view = document.createElement('i');
    const obj = active.get(id);
    const icon = document.createElement('b');
    icon.className = obj?.hiddenByEye ? 'icon-view-off' : 'icon-view';
    view.appendChild(icon);

    view.addEventListener('click', () => {
      if (!obj) return;
      obj.hiddenByEye = !obj.hiddenByEye;
      obj.layer.visible = !obj.hiddenByEye;
      icon.className = obj.hiddenByEye ? 'icon-view-off' : 'icon-view';
      saveToStorage();
      overlayMgr.setVisible(id, !obj.hiddenByEye);
      chartCore.scheduleRender({ full: true });
    });

    span.appendChild(view);

    const settings = document.createElement('i');
    settings.innerHTML = `<b class="icon-settings"></b>`;
    settings.addEventListener('click', () => {
      const event = new CustomEvent('indicator-settings', { detail: { id } });
      window.dispatchEvent(event);
    });
    span.appendChild(settings);

    const del = document.createElement('i');
    del.innerHTML = `<b class="icon-delete"></b>`;
    del.addEventListener('click', () => remove(id));
    span.appendChild(del);

    menu.appendChild(span);
    menu.classList.add('on');
  }

  function removeDOM(id) {
    const el = menu?.querySelector(`[data-indicator="${id}"]`);
    if (el) el.remove();
    if (menu && menu.querySelectorAll('span').length === 0) {
      menu.classList.remove('on');
    }
  }

  // --- управление ---
  function add(id, opts = {}) {
    if (active.has(id)) return;
    const def = Indicators[id];
    if (!def?.meta || typeof def.createIndicator !== 'function') {
      console.warn(`[IndicatorsManager] Индикатор ${id} некорректный`);
      return;
    }
    const layer = new PIXI.Container();
    layer.zIndex = def.meta.zIndex ?? 50;

    let parent;
    if (def.meta.position === 'bottom') {
      parent = chartCore.state.subGroup ?? chartCore.graphGroup;
    } else {
      parent = chartCore.state.candleLayer ?? chartCore.graphGroup;
    }
    if (!parent) {
      console.warn('[IndicatorsManager] нет контейнера для', id);
      return;
    }
    parent.addChild(layer);

    const hiddenByEye = !!opts.hiddenByEye;
    layer.visible = !hiddenByEye;

    if (fullscreenMode && def.meta.position === 'bottom') {
      layer.visible = false;
    }

    const height = opts.height ?? def.meta.height ?? 100;

    active.set(id, {
      meta: def.meta,
      instance: null,
      layer,
      def,
      hiddenByEye,
      title: def.meta.name ?? id,
      params: def.meta.paramsText ?? '',
      height
    });

    renderDOM(id);
    saveToStorage();
    chartCore.scheduleRender({ full: true });
  }

  function remove(id) {
    const obj = active.get(id);
    if (!obj) return;
    const parent = obj.meta.position === 'bottom'
      ? chartCore.state.subGroup ?? chartCore.graphGroup
      : chartCore.state.graphGroup;
    parent.removeChild(obj.layer);
    obj.layer.destroy({ children: true });
    active.delete(id);
    overlayMgr.removeOverlay(id);
    removeDOM(id);
    saveToStorage();
    window.dispatchEvent(new CustomEvent('indicator-removed', { detail: { id } }));
    chartCore.scheduleRender({ full: true });
  }

  function normalizeLayout(layout) {
    if (!layout) return layout;
    layout.candles ||= chartCore.state.candles;
    layout.config  ||= chartCore.config;
    return layout;
  }

  function renderAll(layout) {
    if (!layout) return;
    const L = normalizeLayout(layout);
    let offsetY = 0;

    for (const [id, obj] of active.entries()) {
      if (!obj.instance && L?.candles?.length) {
        obj.instance = obj.def.createIndicator(
          { layer: obj.layer, chartCore, overlay: chartCore.overlayMgr },
          L
        );
      }
      try {
        if (obj.meta.position === 'bottom') {
          if (fullscreenMode) continue;

          obj.layer.y = offsetY;
          obj.layer.x = 0;

          const h = obj.height;

          const localLayout = {
            ...L,
            plotX: 0,
            plotY: 0,
            plotW: layout.plotW,
            plotH: h
          };

          const globalLayout = {
            plotX: layout.plotX,
            plotY: layout.plotY + layout.plotH + offsetY,
            plotW: layout.plotW,
            plotH: h
          };

          const ov = overlayMgr.ensureOverlay(id, obj.title, obj.params, null, { showPar: true });
          overlayMgr.setVisible(id, !obj.hiddenByEye);
          overlayMgr.updateOverlayBox(id, globalLayout);

          // 🔹 подключаем обработчик к sw
          if (ov?.container) {
            const sw = ov.container.querySelector('.sw');
            if (sw && !sw._resizeBound) {
              sw.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                resizeState = {
                  id,
                  startY: e.clientY,
                  startHeight: obj.height
                };
                document.addEventListener('mousemove', onResizeMove);
                document.addEventListener('mouseup', stopResize);
              });
              sw._resizeBound = true;
            }
          }

          if (!obj.hiddenByEye) {
            obj.instance?.render?.(localLayout, globalLayout);
          }

          offsetY += h;
        } else {
          if (!obj.hiddenByEye) obj.instance?.render?.(L);
        }
      } catch (err) {
        console.error(`[IndicatorsManager] ${id} render error:`, err);
      }
    }
  }

  // 🔹 функции ресайза
  function onResizeMove(e) {
    if (!resizeState) return;
    const obj = active.get(resizeState.id);
    if (!obj) return;
    const dy = resizeState.startY - e.clientY;
    obj.height = Math.max(40, resizeState.startHeight + dy);
    chartCore.scheduleRender({ full: true });
  }

  function stopResize() {
    if (!resizeState) return;
    saveToStorage();
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', stopResize);
    resizeState = null;
  }

  function initFromConfig() {
    destroyIndicators();
    menu?.querySelectorAll("span").forEach(el => el.remove());
    menu?.classList.remove("on");
    const saved = loadFromStorage();
    for (const id of Object.keys(saved)) {
      if (!active.has(id)) add(id, saved[id]);
    }
    fullscreenMode = loadFullscreen();
    chartCore.fullscreenMode = fullscreenMode;
    if (fullscreenMode) {
      enterFullscreen();
    }
    bindMenuSwitcher();
  }

  function destroyIndicators() {
    for (const id of Array.from(active.keys())) {
      remove(id);
    }
    active.clear();
    overlayMgr.clearAll();
  }

  function reset() {
    destroyIndicators();
    localStorage.removeItem(storageKey);
    localStorage.removeItem(fullscreenKey);
    menu?.querySelectorAll("span").forEach(el => el.remove());
    menu?.classList.remove("on");
    fullscreenMode = false;
    chartCore.fullscreenMode = false;
  }

  function getBottomStackHeight() {
    if (fullscreenMode) return 0;
    let total = 0;
    for (const obj of active.values()) {
      if (obj.meta.position === 'bottom' && typeof obj.height === 'number') {
        total += obj.height; // 🔹 учитываем динамическую высоту
      }
    }
    return total;
  }

  function isActive(id) {
    return active.has(id);
  }

  function activeKeys() {
    return Array.from(active.keys());
  }

  function enterFullscreen() {
    fullscreenMode = true;
    chartCore.fullscreenMode = true;
    for (const obj of active.values()) {
      if (obj.meta.position === 'bottom') obj.layer.visible = false;
    }
    saveFullscreen();
    chartCore.scheduleRender({ full: true });
    overlayMgr.toggleAllVisible(false);
  }

  function exitFullscreen() {
    fullscreenMode = false;
    chartCore.fullscreenMode = false;
    for (const obj of active.values()) {
      if (obj.meta.position === 'bottom' && !obj.hiddenByEye) {
        obj.layer.visible = true;
      }
    }
    saveFullscreen();
    chartCore.scheduleRender({ full: true });
    for (const [id, obj] of active.entries()) {
      overlayMgr.setVisible(id, !obj.hiddenByEye);
    }
  }

  function toggleFullscreen() {
    if (fullscreenMode) exitFullscreen();
    else enterFullscreen();
  }

  function toggleAllVisibleOnDblClick(visible) {
    for (const [id, obj] of active.entries()) {
      if (obj.meta.position === 'bottom') {
        obj.layer.visible = visible && !obj.hiddenByEye;
        overlayMgr.setVisible(id, visible && !obj.hiddenByEye);
      }
    }
    chartCore.scheduleRender({ full: true });
  }

  // 🔹 Универсальный вызов updateHover для всех индикаторов
  function updateHoverAll(candle, idx) {
    for (const [, obj] of active.entries()) {
      obj.instance?.updateHover?.(candle, idx);
    }
  }

  return {
    add,
    remove,
    renderAll,
    initFromConfig,
    destroy: destroyIndicators,
    reset,
    getBottomStackHeight,
    isActive,
    activeKeys,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    toggleAllVisibleOnDblClick,
    updateHoverAll
  };
}
