import { computeGrid } from './chart-grid.js';
import { ChartConfig } from './chart-config.js';

export function renderGrid(app, layout, settings) {
  if (!ChartConfig.grid.gridEnabled || !settings?.grid?.enabled || !layout?.group) return;

  let gridLayer = layout.group.children.find(child => child.__gridLayer);
  if (!gridLayer) {
    gridLayer = new PIXI.Container();
    gridLayer.__gridLayer = true;
    gridLayer.zIndex = -1;
    app.stage.sortableChildren = true;
    layout.group.addChild(gridLayer);
  }

  let gridLines = gridLayer.children.find(child => child.__gridLines);
  if (!gridLines) {
    gridLines = new PIXI.Graphics();
    gridLines.__gridLines = true;
    gridLayer.addChild(gridLines);
  }

  gridLines.clear();

  const gridColor = PIXI.utils.string2hex(ChartConfig.grid.gridColor);
  const { width: w, height: h, config } = layout;
  const { rightOffset = 0, bottomOffset = 0 } = config;

  const grid = computeGrid(layout, settings);
  if (!grid) return;

  for (const x of grid.verticalLines) {
    gridLines.lineStyle(1, gridColor, 1);
    gridLines.moveTo(x, 0);
    gridLines.lineTo(x, h - bottomOffset);
  }

  for (const y of grid.horizontalLines) {
    gridLines.lineStyle(1, gridColor, 1);
    gridLines.moveTo(0, y);
    gridLines.lineTo(w - rightOffset, y);
  }
}
