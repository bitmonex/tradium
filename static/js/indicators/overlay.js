// indicators/overlay.js
export function createOverlayManager(chartCore) {
  const overlays = new Map();

  function getCanvasParent() {
    const view = chartCore?.app?.view ?? chartCore?.state?.canvas ?? null;
    return view?.parentNode ?? null;
  }

  function ensureOverlay(id, title, par, getValue, opts = {}) {
    let ov = overlays.get(id);
    if (ov) return ov;

    const { showPar = true } = opts; // showVal убрали

    const container = document.createElement('div');
    container.className = 'indicator-overlay';
    container.dataset.indicator = id;
    container.style.position = 'absolute';
    container.style.pointerEvents = 'none';
    container.style.zIndex = 100;

    const header = document.createElement('div');
    header.className = 'iheader';
    header.style.position = 'absolute';
    header.style.top = '0';
    header.style.left = '0';
    header.style.right = '0';
    header.style.height = '20px';
    header.style.pointerEvents = 'auto';

    // --- span с названием и иконками
    const span = document.createElement('span');

    const strong = document.createElement('strong');
    strong.textContent = title ?? id;
    span.appendChild(strong);

    const eye = document.createElement('i');
    eye.innerHTML = `<b class="icon-view"></b>`;
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      const ov = overlays.get(id);
      if (!ov) return;
      const isVisible = ov.container.style.display !== 'none';
      setVisible(id, !isVisible);
    });
    span.appendChild(eye);

    const settings = document.createElement('i');
    settings.innerHTML = `<b class="icon-settings"></b>`;
    settings.addEventListener('click', (e) => {
      e.stopPropagation();
      chartCore.emit?.('indicator:settings', { id });
    });
    span.appendChild(settings);

    const del = document.createElement('i');
    del.innerHTML = `<b class="icon-delete"></b>`;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      removeOverlay(id);
      chartCore.emit?.('indicator:remove', { id });
    });
    span.appendChild(del);

    header.appendChild(span);

    // --- параметры (если есть и showPar = true)
    let em = null;
    if (showPar && par) {
      em = document.createElement('em');
      em.textContent = par;
      header.appendChild(em);
    }

    container.appendChild(header);

    const parentNode = getCanvasParent();
    if (parentNode) parentNode.appendChild(container);

    ov = { id, container, header, em, visibleBody: true };
    overlays.set(id, ov);
    return ov;
  }

  function updateValue(id, getValue) {
    // теперь ничего не делаем, так как u убран
    return;
  }

  function updateOverlayBox(id, subLayout) {
    const ov = overlays.get(id);
    if (!ov) return;
    const { plotX, plotY, plotW, plotH } = subLayout;
    ov.container.style.left = plotX + 'px';
    ov.container.style.top = plotY + 'px';
    ov.container.style.width = plotW + 'px';
    ov.container.style.height = plotH + 'px';
  }

  function removeOverlay(id) {
    const ov = overlays.get(id);
    if (!ov) return;
    ov.container.remove();
    overlays.delete(id);
  }

  function clearAll() {
    for (const ov of overlays.values()) {
      ov.container.remove();
    }
    overlays.clear();
    document.querySelectorAll('.indicator-overlay').forEach(el => el.remove());
  }

  function setVisible(id, visible) {
    const ov = overlays.get(id);
    if (!ov) return;
    ov.container.style.display = visible ? 'block' : 'none';
  }
  
  function toggleAllVisible(visible) {
    for (const [id, ov] of overlays.entries()) {
      if (!ov) continue;
      ov.container.style.display = visible ? 'block' : 'none';
    }
  }

  return {
    ensureOverlay,
    updateOverlayBox,
    updateValue,
    removeOverlay,
    clearAll,
    setVisible,
    toggleAllVisible
  };
}
