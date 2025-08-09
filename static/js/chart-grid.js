import { ChartConfig } from './chart-config.js';

function getAdaptiveStepX(scaleX, candleWidth, spacing) {
    const spacingPx = (candleWidth + spacing) * scaleX;
    const minSpacing = 100;
    if (spacingPx < minSpacing) {
        const boostFactor = Math.ceil(minSpacing / spacingPx);
        return Math.max(1, boostFactor);
    }
    return 1;
}

function getAdaptiveStepY(scaleY) {
    const baseStep = 50;
    const minStep = 30;
    const zoomedStep = Math.round(baseStep * scaleY);
    return Math.max(minStep, zoomedStep);
}

export function Grid(app, layout, candles, settings) {
    if (!ChartConfig.grid.gridEnabled || !settings?.grid?.enabled || !candles?.length) return;

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

    const {
        width: w,
        height: h,
        config: { candleWidth, spacing },
        scaleX,
        scaleY = 1,
        offsetX,
        offsetY,
        rightOffset = 0,
        bottomOffset = 0
    } = layout;

    const futureExtension = settings.grid.futureExtension ?? 10;
    const gridColor = PIXI.utils.string2hex(ChartConfig.grid.gridColor);
    const totalSpacing = candleWidth + spacing;
    const candleCount = candles.length;
    const extendedCount = candleCount + futureExtension;
    let stepX = getAdaptiveStepX(scaleX, candleWidth, spacing);
    if (scaleX < 0.3 && stepX < 10) stepX = 10;
    const stepY = getAdaptiveStepY(scaleY);

    // Вертикальные линии по индексам свечей
    const anchorIndex = Math.floor(candleCount / 2);
    const minLineSpacingPx = 4;
    const maxLinesLeft = Math.floor(anchorIndex / stepX);
    const maxLinesRight = Math.floor((extendedCount - anchorIndex) / stepX);
    let lastX = -Infinity;
    let verticalCount = 0;

    for (let i = -maxLinesLeft; i <= maxLinesRight; i++) {
        const index = anchorIndex + i * stepX;
        if (index < 0 || index >= extendedCount) continue;

        const barCenter = offsetX + index * totalSpacing * scaleX + (candleWidth * scaleX) / 2;
        const visible = barCenter >= 0 && barCenter <= w - rightOffset;
        if (!visible || Math.abs(barCenter - lastX) < minLineSpacingPx) continue;

        gridLines.lineStyle(1, gridColor, 1);
        gridLines.moveTo(barCenter, 0);
        gridLines.lineTo(barCenter, h - bottomOffset);
        lastX = barCenter;
        verticalCount++;
    }

    // Горизонтальные линии по пикселям
    const startY = (offsetY % stepY + stepY) % stepY;
    let horizontalCount = 0;

    gridLines.lineStyle(1, gridColor, 1);
    for (let y = startY; y < h - bottomOffset; y += stepY) {
        gridLines.moveTo(0, y);
        gridLines.lineTo(w - rightOffset, y);
        horizontalCount++;
    }

    //console.log("📊 Vertical lines drawn:", verticalCount);
    //console.log("📶 Horizontal lines drawn:", horizontalCount);
}
