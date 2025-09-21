//chart-zoom.js
export const zoomX = ({ mx, scaleX, offsetX, config, direction }) => {
  const cw = config.candleWidth + config.spacing;
  const worldX = (mx - offsetX) / (cw * scaleX);
  const newScaleX = Math.max(config.minScaleX, Math.min(config.maxScaleX, scaleX * direction));
  return { scaleX: newScaleX, offsetX: mx - worldX * (cw * newScaleX) };
};

export const zoomY = ({ my, scaleY, offsetY, config, direction, height }) => {
  const worldY = (my - offsetY) / (height * scaleY);
  const newScaleY = Math.max(config.minScaleY, Math.min(config.maxScaleY, scaleY * direction));
  return { scaleY: newScaleY, offsetY: my - worldY * (height * newScaleY) };
};

export const pan = ({ offsetX, offsetY, dx, dy }) => ({ offsetX: offsetX + dx, offsetY: offsetY + dy });

