export function Mouse(app, config, handlers) {
  let dragging = false;
  let resizingX = false;
  let resizingY = false;
  let lastX = 0;
  let lastY = 0;

    const onMouseDown = e => {
        const rect = app.view.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const isRightScale = x > rect.width - config.rightOffset;
        const isBottomScale = y > rect.height - config.bottomOffset;
        if (isRightScale) {
            resizingY = true;
        } else if (isBottomScale) {
            resizingX = true;
        } else if (handlers.getBounds(e)) {
            dragging = true;
            handlers.onDragStart?.();
            app.view.style.cursor = 'grabbing';
        }
        lastX = e.clientX;
        lastY = e.clientY;
    };

    const onMouseUp = e => {
      dragging = false;
      resizingX = false;
      resizingY = false;
      handlers.onDragEnd?.();
      const rect = app.view.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const isRightScale = x > rect.width - config.rightOffset;
      const isBottomScale = y > rect.height - config.bottomOffset;
      const isInChartArea = handlers.getBounds(e);
      if (isRightScale) {
        app.view.style.cursor = 'ns-resize';
      } else if (isBottomScale) {
        app.view.style.cursor = 'ew-resize';
      } else if (isInChartArea) {
        app.view.style.cursor = 'default';
      }
    };

    const onMouseMove = e => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const rect = app.view.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const isRightScale = x > rect.width - config.rightOffset;
      const isBottomScale = y > rect.height - config.bottomOffset;
      const isInChartArea = handlers.getBounds(e);
      if (!dragging && !resizingX && !resizingY) {
        if (isRightScale) {
          app.view.style.cursor = 'ns-resize';
        } else if (isBottomScale) {
          app.view.style.cursor = 'ew-resize';
        } else if (isInChartArea) {
          app.view.style.cursor = 'default';
        }
      }
      if (dragging) {
        handlers.onDragMove?.(dx, dy);
      } else if (resizingX) {
        const zoomFactor = 1 - dx * 0.02;
        const factor = Math.max(0.5, Math.min(2, zoomFactor));
        handlers.zoomAt?.(centerX, factor);
      } else if (resizingY) {
        const zoomFactor = 1 - dy * 0.02;
        const factor = Math.max(0.5, Math.min(2, zoomFactor));
        handlers.zoomYAt?.(centerY, factor);
      }

      handlers.onMouseUpdate?.(e);
    };

  const onWheel = e => {
    e.preventDefault();
    handlers.onWheelZoom?.(e);
  };

  app.view.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  app.view.addEventListener('wheel', onWheel, { passive: false });

  return {
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onWheel
  };
}
