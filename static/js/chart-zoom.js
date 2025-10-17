//chart-zoom.js
export const zoomX = ({ mx, scaleX, offsetX, config, direction }) => {
  const candleWidth = Number(config.candleWidth ?? 6);
  const spacing     = Number(config.spacing ?? 2);
  const cw = candleWidth + spacing;

  const safeScaleX = (typeof scaleX === 'number' && !isNaN(scaleX)) ? scaleX : 1;
  const safeOffsetX = (typeof offsetX === 'number' && !isNaN(offsetX)) ? offsetX : 0;

  const worldX = (mx - safeOffsetX) / (cw * safeScaleX);
  const newScaleX = Math.max(config.minScaleX ?? 0.05, Math.min(config.maxScaleX ?? 20, safeScaleX * direction));
  const newOffsetX = mx - worldX * (cw * newScaleX);

  //console.log('[zoomX]', { mx, scaleX, offsetX, safeScaleX, safeOffsetX, cw, worldX, newScaleX, newOffsetX });

  return { scaleX: newScaleX, offsetX: newOffsetX };
};


export const zoomY = ({ my, scaleY, offsetY, config, direction, height }) => {
  const safeHeight = Number(height || 1); // чтобы не делить на undefined
  const worldY = (my - offsetY) / (safeHeight * scaleY);
  const newScaleY = Math.max(config.minScaleY, Math.min(config.maxScaleY, scaleY * direction));
  const newOffsetY = my - worldY * (safeHeight * newScaleY);

  //console.log('[zoomY]', { my, scaleY, offsetY, direction, safeHeight, worldY, newScaleY, newOffsetY });

  return { scaleY: newScaleY, offsetY: newOffsetY };
};

export const pan = ({ offsetX, offsetY, dx, dy }) => ({ offsetX: offsetX + dx, offsetY: offsetY + dy });

