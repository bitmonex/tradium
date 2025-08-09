import { ChartConfig } from './chart-config.js';

export function ChartScales(app, candles, layout) {
    if (!ChartConfig.scales) return;

    if (ChartConfig.scales.scaleTime) {
        const timeTicks = generateTimeTicks(candles, layout);
        drawScale(app, layout, timeTicks, "horizontal");
    }

    if (ChartConfig.scales.scalePrice) {
        const priceTicks = generatePriceTicks(candles, layout);
        drawScale(app, layout, priceTicks, "vertical");
    }
}

export function drawScale(app, layout, ticks, orientation = "horizontal") {
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

    graphics.on("pointerdown", (e) => {
        e.stopPropagation();
        graphics.cursor = isHorizontal ? 'ew-resize' : 'ns-resize';

        const startX = e.data.global.x;
        const startY = e.data.global.y;
        const startScaleX = layout.scaleX;
        const startScaleY = layout.scaleY;

        const onMove = (ev) => {
            const dx = ev.data.global.x - startX;
            const dy = ev.data.global.y - startY;

            if (isHorizontal) {
                layout.scaleX = Math.max(0.1, startScaleX + dx * 0.005);
            } else {
                layout.scaleY = Math.max(0.1, startScaleY - dy * 0.005);
            }

            app.render();
        };

        const onUp = () => {
            app.stage.off("pointermove", onMove);
            app.stage.off("pointerup", onUp);
        };

        app.stage.on("pointermove", onMove);
        app.stage.on("pointerup", onUp);
    });

    const style = new PIXI.TextStyle({ fill: 0xffffff, fontSize: 11.2 });
    let prevCoord = null;

    for (const tick of ticks) {
        const pos = isHorizontal ? tick.x : tick.y;
        const limit = isHorizontal ? w - 70 : h - 30;
        const minGap = isHorizontal ? 28 : style.fontSize * 1.5;

        if (pos < 0 || pos > limit) continue;
        if (prevCoord !== null && Math.abs(pos - prevCoord) < minGap) continue;
        prevCoord = pos;

        const label = new PIXI.Text(tick.label, new PIXI.TextStyle({
            fill: 0xffffff,
            fontSize: (tick.type === "month" || tick.type === "year") ? 12 : 11,
            fontWeight: (tick.type === "month" || tick.type === "year") ? "bold" : "normal"
        }));

        if (isHorizontal) {
            label.anchor.set(0.5, 0);
            label.x = pos;
            label.y = h - 21;
        } else {
            label.anchor.set(0, 0.5);
            label.x = w - 70 + 11;
            label.y = pos;
        }

        scaleLayer.addChild(label);

        const line = new PIXI.Graphics();
        line.lineStyle(1, 0xffffff, tick.type === "day" || tick.type === "hour" ? 0.25 : 1);
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

let cachedTimeTicks = [];
let cachedHash = "";

export function generateTimeTicks(candles, layout) {
    const ticks = [];
    if (!candles?.length || layout.scaleX <= 0) return ticks;

    const spacing = layout.config.candleWidth + layout.config.spacing;
    const minGap = 40;
    const tf = detectTimeframe(candles);
    const zoom = layout.scaleX;

    const hash = candles.length + "_" + layout.offsetX + "_" + layout.scaleX + "_" + layout.width;
    if (hash === cachedHash && cachedTimeTicks.length > 0) return cachedTimeTicks;
    cachedHash = hash;

    let prevX = null;
    let prevMonth = null;
    let prevYear = null;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const ts = new Date(c.time);
        const x = layout.offsetX + i * spacing * zoom;
        if (x < 0 || x > layout.width - layout.rightOffset) continue;

        let label = "", type = "time";

        if (tf === "1d" || zoom <= 0.4 || tf === "3d" || tf === "1w") {
            const day = ts.getDate();
            const month = ts.getMonth();
            const year = ts.getFullYear();
            label = String(day);
            type = "day";

            if (prevMonth !== null && prevMonth !== month) {
                ticks.push({ x: x - 20, label: getMonthName(month), type: "month" });
            }

            if (zoom < 0.3 && prevYear !== year) {
                ticks.push({ x: x, label: String(year), type: "year" });
            }

            prevMonth = month;
            prevYear = year;

        } else if (zoom > 1.5) {
            const hour = ts.getHours().toString().padStart(2, "0");
            const minute = ts.getMinutes().toString().padStart(2, "0");
            label = hour + ":" + minute;
            type = "hour";

        } else {
            const day = ts.getDate();
            label = String(day);
            type = "day";
        }

        if (prevX === null || Math.abs(x - prevX) > minGap) {
            ticks.push({ x, label, type });
            prevX = x;
        }
    }

    if (ticks.length > 100) ticks.length = 100;

    cachedTimeTicks = ticks;
    return ticks;
}

export function generatePriceTicks(candles, layout) {
    const ticks = [];
    if (!candles?.length || layout.scaleY <= 0) return ticks;

    const min = Math.min(...candles.map(c => c.low ?? c.close ?? 0));
    const max = Math.max(...candles.map(c => c.high ?? c.close ?? 0));
    const range = max - min;
    const step = range / 6;

    for (let i = 0; i <= 6; i++) {
        const value = min + i * step;
        const y = layout.height - layout.bottomOffset - ((value - min) / range) * (layout.height - layout.bottomOffset);
        ticks.push({ label: value.toFixed(2), y });
    }

    return ticks;
}

function detectTimeframe(candles) {
    if (!candles || candles.length < 2) return "1h";
    const delta = candles[1].time - candles[0].time;
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;

    if (delta >= 7 * day) return "1w";
    if (delta >= 3 * day) return "3d";
    if (delta >= day) return "1d";
    if (delta >= 12 * hour) return "12h";
    if (delta >= 6 * hour) return "6h";
    if (delta >= 4 * hour) return "4h";
    if (delta >= hour) return "1h";
    if (delta >= 30 * min) return "30m";
    if (delta >= 15 * min) return "15m";
    if (delta >= 5 * min) return "5m";
    return "1m";
}

function getMonthName(index) {
    const months = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    return months[index] ?? "";
}
