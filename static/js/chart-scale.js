import { ChartConfig } from './chart-config.js';

export function ChartScales(app, candles, layout) {
  if (!ChartConfig.scales) return;

  // Удаляем старые шкалы
  const oldScales = app.stage.children.filter(c => c.__isScaleLayer);
  for (const s of oldScales) {
    app.stage.removeChild(s);
    s.destroy({ children: true });
  }

  if (ChartConfig.scales.scaleTime) {
    const timeTicks = generateTimeTicksFromGrid(candles, layout);
    drawScaleBox(app, layout, timeTicks, "horizontal");
  }

  if (ChartConfig.scales.scalePrice) {
    const priceTicks = generatePriceTicksFromGrid(layout);
    drawScaleBox(app, layout, priceTicks, "vertical");
  }
}

function drawScaleBox(app, layout, ticks, orientation = "horizontal") {
  const w = app.renderer.width;
  const h = app.renderer.height;
  const isHorizontal = orientation === "horizontal";

  const scaleLayer = new PIXI.Container();
  scaleLayer.__isScaleLayer = true;

  const graphics = new PIXI.Graphics();
  graphics.beginFill(0x444444);

  if (isHorizontal) {
    graphics.drawRect(0, h - 30, w - 70, 30);
    graphics.cursor = 'ew-resize';
  } else {
    graphics.drawRect(w - 70, 0, 70, h - 30);
    graphics.cursor = 'ns-resize';
  }

  graphics.interactive = true;
  graphics.hitArea = isHorizontal
    ? new PIXI.Rectangle(0, h - 30, w - 70, 30)
    : new PIXI.Rectangle(w - 70, 0, 70, h - 30);

  scaleLayer.addChild(graphics);
  scaleLayer.zIndex = 999;
  graphics.zIndex = 1000;
  app.stage.sortableChildren = true;

  for (const tick of ticks) {
    const pos = isHorizontal ? tick.x : tick.y;
    const limit = isHorizontal ? w - 70 : h - 30;
    if (pos < 0 || pos > limit) continue;

    const line = new PIXI.Graphics();
    line.lineStyle(1, 0xffffff, 1);

    if (isHorizontal) {
      line.moveTo(pos, h - 30);
      line.lineTo(pos, h - 23);
    } else {
      line.moveTo(w - 70, pos);
      line.lineTo(w - 64, pos);
    }

    scaleLayer.addChild(line);
  }

  app.stage.addChild(scaleLayer);
}

function generateTimeTicksFromGrid(candles, layout) {
  const ticks = [];
  const {
    config: { candleWidth, spacing },
    scaleX,
    offsetX,
    width: w,
    rightOffset = 0
  } = layout;

  const totalSpacing = candleWidth + spacing;
  const anchorIndex = Math.floor(candles.length / 2);
  let stepX = Math.ceil(100 / (totalSpacing * scaleX));
  if (scaleX < 0.3 && stepX < 10) stepX = 10;

  const maxLeft = Math.floor(anchorIndex / stepX);
  const maxRight = Math.floor((candles.length - anchorIndex) / stepX);

  for (let i = -maxLeft; i <= maxRight; i++) {
    const index = anchorIndex + i * stepX;
    if (index < 0 || index >= candles.length) continue;

    const x = offsetX + index * totalSpacing * scaleX + (candleWidth * scaleX) / 2;
    if (x >= 0 && x <= w - rightOffset) {
      ticks.push({ x });
    }
  }

  return ticks;
}

function generatePriceTicksFromGrid(layout) {
  const ticks = [];
  const {
    scaleY,
    offsetY,
    height: h,
    bottomOffset = 30
  } = layout;

  const stepY = getAdaptiveStepY(scaleY);
  const startY = (offsetY % stepY + stepY) % stepY;

  for (let y = startY; y <= h - bottomOffset; y += stepY) {
    ticks.push({ y });
  }

  return ticks;
}

function getAdaptiveStepY(scaleY) {
  const baseStep = 50;
  const minStep = 30;
  const zoomedStep = Math.round(baseStep * scaleY);
  return Math.max(minStep, zoomedStep);
}
