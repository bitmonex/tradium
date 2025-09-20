// chart-mouse.js
export function Mouse(app, config, state, { zoomX, zoomY, pan, render, update }) {
  let dragging = false, resizingX = false, resizingY = false, lastX = 0, lastY = 0, movedScale = false;
  let centerX = 0, centerY = 0, worldX0 = 0, worldY0 = 0, canvasH = 0;
  const cw = config.candleWidth + config.spacing;
  let rafPending = false;

  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => { render(); rafPending = false; });
    }
  }

  function onPointerDown(e) {
    movedScale = false;
    const r = app.view.getBoundingClientRect();
    centerX = r.width * 0.5;
    centerY = r.height * 0.5;
    canvasH = app.renderer.height;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x > r.width - config.rightOffset) {
      resizingY = true;
      worldY0 = (centerY - state.offsetY) / (canvasH * state.scaleY);
      app.view.style.cursor = 'ns-resize';
    } else if (y > r.height - config.bottomOffset) {
      resizingX = true;
      worldX0 = (centerX - state.offsetX) / (cw * state.scaleX);
      app.view.style.cursor = 'ew-resize';
    } else {
      dragging = true;
      app.view.style.cursor = 'grabbing';
    }
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerMove(e) {
    // Сохраняем координаты мыши относительно канвы
    const r = app.view.getBoundingClientRect();
    state.mouseX = e.clientX - r.left;
    state.mouseY = e.clientY - r.top;

    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (dragging) {
      const p = pan({ offsetX: state.offsetX, offsetY: state.offsetY, dx, dy });
      state.offsetX = p.offsetX;
      state.offsetY = p.offsetY;
      render();
    } else if (resizingX && dx !== 0) {
      movedScale = true;
      let f = Math.max(config.minScaleX / state.scaleX, Math.min(config.maxScaleX / state.scaleX, 1 - dx * 0.05));
      state.scaleX *= f;
      state.offsetX = centerX - worldX0 * (cw * state.scaleX);
      render();
    } else if (resizingY && dy !== 0) {
      movedScale = true;
      let f = Math.max(config.minScaleY / state.scaleY, Math.min(config.maxScaleY / state.scaleY, 1 - dy * 0.05));
      state.scaleY *= f;
      state.offsetY = centerY - worldY0 * (canvasH * state.scaleY);
      render();
    } else {
      const x = e.clientX, y = e.clientY;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;

      const xCanvas = x - r.left;
      const L = state.layout;
      if (!L || !state.candles.length) return;

      const inside =
        state.mouseX >= L.plotX &&
        state.mouseX <= L.plotX + L.plotW &&
        state.mouseY >= L.plotY &&
        state.mouseY <= L.plotY + L.plotH;

      if (!inside) return;

      const t = L.screenToTime(xCanvas);
      const C = state.candles;
      const idx = Math.min(Math.max(Math.floor((t - C[0].time) / L.tfMs), 0), C.length - 1);

      if (idx === state._lastHoverIdx) return;
      state._lastHoverIdx = idx;

      update(C[idx]);
      scheduleRender();
    }

  }
  
  function onPointerUp() {
    dragging = resizingX = resizingY = false;
    app.view.style.cursor = 'default';
  }

  function onWheel(e) {
    e.preventDefault();
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if (ax > ay + 2) {
      state.offsetX -= e.deltaX;
      render();
    } else if (ay > ax + 2) {
      const f = Math.exp(-e.deltaY * 0.005);
      const r = app.view.getBoundingClientRect();
      if (e.shiftKey) {
        const z = zoomY({ my: r.height / 2, scaleY: state.scaleY, offsetY: state.offsetY, config, direction: f, height: app.renderer.height });
        state.scaleY = z.scaleY;
        state.offsetY = z.offsetY;
      } else {
        const z = zoomX({ mx: e.offsetX, scaleX: state.scaleX, offsetX: state.offsetX, config, direction: f });
        state.scaleX = z.scaleX;
        state.offsetX = z.offsetX;
      }
      render();
    }
  }

  function onClick(e) {
    if (movedScale) { movedScale = false; return; }
    const r = app.view.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const factor = e.shiftKey ? 0.9 : 1.1;
    if (x > r.width - config.rightOffset) {
      const z = zoomY({ my: y, scaleY: state.scaleY, offsetY: state.offsetY, config, direction: factor, height: app.renderer.height });
      state.scaleY = z.scaleY;
      state.offsetY = z.offsetY;
      scheduleRender();
    } else if (y > r.height - config.bottomOffset) {
      const z = zoomX({ mx: x, scaleX: state.scaleX, offsetX: state.offsetX, config, direction: factor });
      state.scaleX = z.scaleX;
      state.offsetX = z.offsetX;
      scheduleRender();
    }
  }

  return {
    init() {
      const v = app?.view;
      if (!v) return;
      v.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      v.addEventListener('wheel', onWheel, { passive: false });
      v.addEventListener('click', onClick);
    },
    destroy() {
      const v = app?.view;
      if (v) {
        v.removeEventListener('pointerdown', onPointerDown);
        v.removeEventListener('wheel', onWheel);
        v.removeEventListener('click', onClick);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
  };
}
