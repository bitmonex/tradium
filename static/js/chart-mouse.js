// chart-mouse.js

/**
 * Mouse handler for pan/zoom/hover and click-to-zoom on scales
 *
 * @param {PIXI.Application} app
 * @param {object} config
 * @param {object} state
 * @param {{ zoomX, zoomY, pan, render, update }} actions
 */
export function Mouse(app, config, state, { zoomX, zoomY, pan, render, update }) {
  let dragging    = false;
  let resizingX   = false;
  let resizingY   = false;
  let lastX       = 0;
  let lastY       = 0;
  let movedScale  = false;     // флаг: был ли реальный drag/resize

  // inline‐zoom helpers
  let centerX   = 0;
  let centerY   = 0;
  let worldX0   = 0;
  let worldY0   = 0;
  const cw      = config.candleWidth + config.spacing;
  let canvasH   = 0;

  // throttle render through rAF
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

  function onPointerDown(e) {
    // сбрасываем флаг перед новым нажатием
    movedScale = false;

    const r = app.view.getBoundingClientRect();
    centerX = r.width  * 0.5;
    centerY = r.height * 0.5;
    canvasH = app.renderer.height;

    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (x > r.width - config.rightOffset) {
      // click+drag на правой шкале → вертикальный resize от центра
      resizingY = true;
      // рассчитываем worldY0 так, чтобы при f=1 offsetY не смещался
      worldY0 = (centerY - state.offsetY) / (canvasH * state.scaleY);
      app.view.style.cursor = 'ns-resize';

    } else if (y > r.height - config.bottomOffset) {
      // click+drag на нижней шкале → горизонтальный resize от центра
      resizingX = true;
      worldX0 = (centerX - state.offsetX) / (cw * state.scaleX);
      app.view.style.cursor = 'ew-resize';

    } else {
      // простой pan
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
      // pan
      const p = pan({
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        dx, dy
      });
      state.offsetX = p.offsetX;
      state.offsetY = p.offsetY;
      render();

    } else if (resizingX) {
      // inline-zoom X от центра
      if (dx !== 0) {
        movedScale = true;  // зафиксировали реальное движение
        let f = 1 - dx * 0.05;
        f = Math.max(config.minScaleX / state.scaleX,
                     Math.min(config.maxScaleX / state.scaleX, f));

        const newScaleX  = state.scaleX * f;
        const newOffsetX = centerX - worldX0 * (cw * newScaleX);

        state.scaleX  = newScaleX;
        state.offsetX = newOffsetX;
        render();
      }

    } else if (resizingY) {
      // inline-zoom Y от центра
      if (dy !== 0) {
        movedScale = true;
        let f = 1 - dy * 0.05;
        f = Math.max(config.minScaleY / state.scaleY,
                     Math.min(config.maxScaleY / state.scaleY, f));

        const newScaleY  = state.scaleY * f;
        const newOffsetY = centerY - worldY0 * (canvasH * newScaleY);

        state.scaleY  = newScaleY;
        state.offsetY = newOffsetY;
        render();
      }

    } else {
      // hover по свечам
      const r       = app.view.getBoundingClientRect();
      const xCanvas = e.clientX - r.left;
      const L       = state.layout;
      if (!L || !state.candles.length) return;

      const t         = L.screenToTime(xCanvas);
      const C         = state.candles;
      const firstTime = C[0].time;
      const rawIdx    = (t - firstTime) / L.tfMs;
      const idx       = Math.min(
        Math.max(Math.floor(rawIdx), 0),
        C.length - 1
      );

      update(C[idx]);
      render();
    }
  }

  function onPointerUp() {
    dragging  = false;
    resizingX = false;
    resizingY = false;
    app.view.style.cursor = 'default';
  }

  function onWheel(e) {
    e.preventDefault();
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);

    if (ax > ay + 2) {
      // горизонтальный пан
      state.offsetX -= e.deltaX;
      render();

    } else if (ay > ax + 2) {
      // wheel-zoom
      const r    = app.view.getBoundingClientRect();
      const midY = r.height / 2;
      const f    = Math.exp(-e.deltaY * 0.005);

      if (e.shiftKey) {
        // вертикальный zoom
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
        // горизонтальный zoom
        const z = zoomX({
          mx: e.offsetX,
          scaleX:  state.scaleX,
          offsetX: state.offsetX,
          config,
          direction: f
        });
        state.scaleX  = z.scaleX;
        state.offsetX = z.offsetX;
      }

      render();
    }
  }

  /**
   * Click-to-zoom on scales (step zoom)
   */
  function onClick(e) {
    // если до этого был drag/resize, игнорируем click
    if (movedScale) {
      movedScale = false;
      return;
    }

    const rect = app.view.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const w    = rect.width;
    const h    = rect.height;

    // шаговый zoom по правой шкале
    if (x > w - config.rightOffset) {
      const factor = e.shiftKey ? 0.9 : 1.1;
      const z = zoomY({
        my: y,
        scaleY:  state.scaleY,
        offsetY: state.offsetY,
        config,
        direction: factor,
        height: app.renderer.height
      });
      state.scaleY  = z.scaleY;
      state.offsetY = z.offsetY;
      scheduleRender();

    // шаговый zoom по нижней шкале
    } else if (y > h - config.bottomOffset) {
      const factor = e.shiftKey ? 0.9 : 1.1;
      const z = zoomX({
        mx: x,
        scaleX:  state.scaleX,
        offsetX: state.offsetX,
        config,
        direction: factor
      });
      state.scaleX  = z.scaleX;
      state.offsetX = z.offsetX;
      scheduleRender();
    }
  }

  return {
    init() {
      app.view.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove',   onPointerMove);
      window.addEventListener('pointerup',     onPointerUp);
      app.view.addEventListener('wheel',       onWheel, { passive: false });
      app.view.addEventListener('click',       onClick);
    },
    destroy() {
      app.view.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove',   onPointerMove);
      window.removeEventListener('pointerup',     onPointerUp);
      app.view.removeEventListener('wheel',       onWheel);
      app.view.removeEventListener('click',       onClick);
    }
  };
}
