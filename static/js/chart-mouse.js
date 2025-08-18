// chart-mouse.js
export function Mouse(app, config, state, { zoomX, zoomY, pan, render, update }) {
  let dragging   = false;
  let resizingX  = false;
  let resizingY  = false;
  let lastX      = 0;
  let lastY      = 0;

  // Вспомогательные данные для зума
  let centerX    = 0;
  let centerY    = 0;
  let worldX0    = 0;
  let worldY0    = 0;
  const cw       = config.candleWidth + config.spacing;
  let canvasH    = 0;

  // Batch-рендер через RAF
  let rafPending = false;
  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        render();
        rafPending = false;
      });
    }
  }

  // Обработчики на Pointer-события
  function onPointerDown(e) {
    const r = app.view.getBoundingClientRect();
    centerX = r.width  * 0.5;
    centerY = r.height * 0.5;
    canvasH = app.renderer.height;

    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (x > r.width - config.rightOffset) {
      // вертикальный зум
      resizingY = true;
      worldY0   = (y - state.offsetY) / (canvasH * state.scaleY);
      app.view.style.cursor = 'ns-resize';

    } else if (y > r.height - config.bottomOffset) {
      // горизонтальный зум
      resizingX = true;
      worldX0   = (x - state.offsetX) / (cw * state.scaleX);
      app.view.style.cursor = 'ew-resize';

    } else {
      // простой пан
      dragging = true;
      app.view.style.cursor = 'grabbing';
    }

    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerMove(e) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (dragging) {
      const p = pan({ offsetX: state.offsetX, offsetY: state.offsetY, dx, dy });
      state.offsetX = p.offsetX;
      state.offsetY = p.offsetY;
      scheduleRender();

    } else if (resizingX) {
      // inline-zoomX
      let f = 1 - dx * 0.02;
      f = Math.max(config.minScaleX / state.scaleX, Math.min(config.maxScaleX / state.scaleX, f));
      const newScaleX  = state.scaleX * f;
      const newOffsetX = centerX - worldX0 * (cw * newScaleX);
      state.scaleX  = newScaleX;
      state.offsetX = newOffsetX;
      scheduleRender();

    } else if (resizingY) {
      // inline-zoomY
      let f = 1 - dy * 0.02;
      f = Math.max(config.minScaleY / state.scaleY, Math.min(config.maxScaleY / state.scaleY, f));
      const newScaleY  = state.scaleY * f;
      const newOffsetY = centerY - worldY0 * (canvasH * newScaleY);
      state.scaleY  = newScaleY;
      state.offsetY = newOffsetY;
      scheduleRender();

    } else {
      // hover
      const r = app.view.getBoundingClientRect();
      const xCanvas = e.clientX - r.left;
      const L = state.layout;
      if (!L) return;
      const t = L.screen2t(xCanvas);
      const idx = Math.min(
        Math.max(Math.floor((t - L.candles[0].time) / L.tfMs), 0),
        L.candles.length - 1
      );
      update(L.candles[idx]);
    }
  }

  function onPointerUp() {
    dragging = resizingX = resizingY = false;
    app.view.style.cursor = 'default';
  }

  function onWheel(e) {
    e.preventDefault();
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);

    if (ax > ay + 2) {
      // пан по горизонтали
      state.offsetX -= e.deltaX;

    } else if (ay > ax + 2) {
      const r = app.view.getBoundingClientRect();
      const midY = r.height / 2;

      if (e.shiftKey) {
        // vertical zoom via wheel+shift
        const f = e.deltaY < 0 ? 1.5 : 0.5;
        const z = zoomY({
          my: midY,
          scaleY:  state.scaleY,
          offsetY: state.offsetY,
          config,
          direction: f,
          height: app.renderer.height
        });
        state.scaleY  = z.scaleY;
        state.offsetY = z.offsetY;

      } else {
        // horizontal zoom
        const dir = e.deltaY < 0 ? 1.1 : 0.9;
        const z = zoomX({
          mx: e.offsetX,
          scaleX:  state.scaleX,
          offsetX: state.offsetX,
          config,
          direction: dir
        });
        state.scaleX  = z.scaleX;
        state.offsetX = z.offsetX;
      }
    }

    scheduleRender();
  }

  return {
    init() {
      app.view.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup',   onPointerUp);
      app.view.addEventListener('wheel',      onWheel, { passive: false });
    },
    destroy() {
      app.view.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
      app.view.removeEventListener('wheel',      onWheel);
    }
  };
}
