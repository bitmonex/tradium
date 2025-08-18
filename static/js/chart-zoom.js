//Горизонтальный зум
export function zoomX({ mx, scaleX, offsetX, config, direction }) {
  const cw = config.candleWidth + config.spacing;
  const worldX = (mx - offsetX) / (cw * scaleX);

  let newScaleX = scaleX * direction;
  newScaleX = Math.max(config.minScaleX, Math.min(config.maxScaleX, newScaleX));

  let newOffsetX = mx - worldX * (cw * newScaleX);
  return { scaleX: newScaleX, offsetX: newOffsetX };
}

//Вертикальный зум
export function zoomY({ my, scaleY, offsetY, config, direction, height }) {
  const worldY = (my - offsetY) / (height * scaleY);

  let newScaleY = scaleY * direction;
  newScaleY = Math.max(config.minScaleY, Math.min(config.maxScaleY, newScaleY));

  let newOffsetY = my - worldY * (height * newScaleY);
  return { scaleY: newScaleY, offsetY: newOffsetY };
}

//Панорама на dx, dy
export function pan({ offsetX, offsetY, dx, dy }) {
  return {
    offsetX: offsetX + dx,
    offsetY: offsetY + dy
  };
}
