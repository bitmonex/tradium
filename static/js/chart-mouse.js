export function Mouse(app, config, handlers) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = e => {
    if (!handlers.getBounds(e)) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    app.view.style.cursor = 'grabbing';
    handlers.onDragStart?.();
  };

  const onMouseUp = () => {
    dragging = false;
    app.view.style.cursor = 'default';
    handlers.onDragEnd?.();
  };

  const onMouseMove = e => {
    if (!handlers.getBounds(e)) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (dragging) handlers.onDragMove?.(dx, dy);
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

  return { onMouseDown, onMouseUp, onMouseMove, onWheel };
}
