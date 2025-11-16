// indicators/overlay.js
export function createOverlayManager(chartCore) {
  const overlays = new Map();

  function getCanvasParent() {
    const view = chartCore?.app?.view ?? chartCore?.state?.canvas ?? null;
    return view?.parentNode ?? null;
  }

  // Создание overlay для индикатора
  function ensureOverlay(id, title, par, opts) {
    const { showPar = true, showVal = true } = opts || {};
    let ov = overlays.get(id);
    if (ov) {
      const strong = ov.header.querySelector('strong');
      if (strong && title) strong.textContent = title;

      // --- PAR ---
      if (showPar && par) {
        if (!ov.em) {
          ov.em = document.createElement('em');
          ov.header.appendChild(ov.em);
        }
        ov.em.textContent = String(par);
      } else if (!showPar && ov.em) {
        ov.em.remove();
        ov.em = null;
      }

      // --- VAL ---
      if (showVal) {
        if (!ov.u) {
          ov.u = document.createElement('u');
          ov.u.textContent = '';
          ov.header.appendChild(ov.u);
        }
      } else if (!showVal && ov.u) {
        ov.u.remove();
        ov.u = null;
      }

      if (ov.em && ov.u) {
        ov.header.insertBefore(ov.em, ov.u);
      }

      return ov;
    }

    // создаём новый overlay
    const container = document.createElement('div');
    container.className = 'indicator-overlay';
    container.dataset.indicator = id;

    // ресайз-переключалка
    const sw = document.createElement('div');
    sw.className = 'sw';
    sw.innerHTML = '<b></b>';
    container.appendChild(sw);

    // header (только заголовок, меню вставляется позже из chart-indicators.js)
    const header = document.createElement('div');
    header.className = 'iheader';
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = title ?? id;
    span.appendChild(strong);
    header.appendChild(span);

    // сначала <em>, потом <u>
    let em = null;
    if (showPar && par) {
      em = document.createElement('em');
      em.textContent = String(par);
      header.appendChild(em);
    }

    let u = null;
    if (showVal) {
      u = document.createElement('u');
      u.textContent = '';
      header.appendChild(u);
    }

    container.appendChild(header);
    const parentNode = getCanvasParent();
    if (parentNode) parentNode.appendChild(container);

    ov = { id, container, header, u, em, visibleBody: true };
    overlays.set(id, ov);
    return ov;
  }

  // Обновление VAL <u>
  function updateValue(id, value, asHtml = false) {
    const ov = overlays.get(id);
    if (!ov) { console.warn('[Overlay] нет overlay для', id); return; }
    if (!ov.u) { console.warn('[Overlay] нет <u> для', id); return; }

    if (asHtml) ov.u.innerHTML = value != null ? String(value) : '';
    else ov.u.textContent = value != null ? String(value) : '';

    // 🔹 синхронизация меню .m-indicators
    const menuU = document.querySelector(`.m-indicators div[data-indicator="${id}"] u`);
    if (menuU) {
      if (asHtml) menuU.innerHTML = value != null ? String(value) : '';
      else menuU.textContent = value != null ? String(value) : '';
    }
  }

  // Обновление PAR <em>
  function updateParam(id, parText) {
    const ov = overlays.get(id);
    if (!ov) return;
    if (!ov.em) {
      ov.em = document.createElement('em');
      ov.header.appendChild(ov.em);
    }
    ov.em.textContent = parText != null ? String(parText) : '';
    if (ov.u) {
      ov.header.insertBefore(ov.em, ov.u);
    }
  }

  // Позиционирование overlay
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
    ov.container.classList.remove('on', 'off');
    if (visible === true) {
      ov.container.classList.add('on');
    } else if (visible === false) {
      ov.container.classList.add('off');
    }
    // undefined/null — без классов: полностью скрыт (например, fullscreen)
  }

  function setHidden(id, hidden) {
    const ov = overlays.get(id);
    if (!ov) return;
    if (hidden) {
      ov.container.classList.add('hide');
    } else {
      ov.container.classList.remove('hide');
    }
  }

  function toggleAllVisible(visible) {
    for (const [, ov] of overlays.entries()) {
      if (!ov) continue;
      ov.container.classList.remove('on', 'off');
      if (visible === true) ov.container.classList.add('on');
      else if (visible === false) ov.container.classList.add('off');
    }
  }

  return {
    ensureOverlay,
    updateValue,
    updateParam,
    updateOverlayBox,
    removeOverlay,
    clearAll,
    setVisible,
    setHidden,
    toggleAllVisible
  };
}
