//Color Changer
const GREEN_START = '#00490c';
const GREEN_END = '#00dc24';
const RED_START = '#7e0000';
const RED_END = '#ff2121';

function interpolateColor(start, end, t) {
    const s = PIXI.utils.hex2rgb(PIXI.utils.string2hex(start));
    const e = PIXI.utils.hex2rgb(PIXI.utils.string2hex(end));
    const rgb = s.map((v, i) => v + (e[i] - v) * t);
    return PIXI.utils.rgb2hex(rgb);
}

function colorScale(value, minChange, maxChange) {
  if (value === 0) return 0x555555; // нейтральный

  if (value > 0) {
    // нормируем value относительно maxChange (>0)
    let intensity = maxChange === 0 ? 0 : value / maxChange;
    intensity = Math.min(1, intensity);
    return interpolateColor(GREEN_START, GREEN_END, intensity);
  } else {
    // value < 0
    // нормируем по модулю относительно minChange (<0)
    let intensity = minChange === 0 ? 0 : Math.abs(value / minChange);
    intensity = Math.min(1, intensity);
    return interpolateColor(RED_START, RED_END, intensity);
  }
}
//Tooltip
function createTooltip(domNode) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.visibility = 'hidden';
    tooltip.style.zIndex = '9999';
    domNode.appendChild(tooltip);
    return tooltip;
}

function showTooltip(tooltip, content, x, y) {
    tooltip.innerHTML = content;
    tooltip.style.visibility = 'visible';
    const tooltipWidth = 180;
    const tooltipHeight = 100;
    const container = tooltip.offsetParent;
    const containerRect = container.getBoundingClientRect();
    let left = x + 15;
    let top = y + 15;

    if (x + tooltipWidth + 15 > containerRect.width) {
        left = x - tooltipWidth - 0;
    }

    if (y + tooltipHeight + 15 > containerRect.height) {
        top = y - tooltipHeight - 15;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip) {
    tooltip.style.visibility = 'hidden';
}

class Treemap {
    constructor(container) {
        if (!container) {
            console.error("Container not found");
            return;
        }

        this.app = new PIXI.Application({
            width: container.clientWidth,
            height: container.clientHeight,
            backgroundColor: 0x111111
        });

        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(container);

        container.appendChild(this.app.view);

        this.stage = this.app.stage;
        this.data = [];

        if (!PIXI.BitmapFont.available["robotoBig"]) {
            PIXI.BitmapFont.from("robotoBig", {
                fontFamily: "Roboto Condensed",
                fontSize: 150,
                fill: "#ffffff"
            }, {
                resolution: 4,
                textureWidth: 1024,
                textureHeight: 2048,
                chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.$-%+'
            });
        }

        this.setupZoom();
        this.container = container;
        this.tooltip = createTooltip(container);
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.app.renderer.resize(width, height);
        this.render();
    }

    setupZoom() {
        this.app.view.addEventListener('wheel', (event) => {
            event.preventDefault();

            const scaleFactor = event.deltaY < 0 ? 1.05 : 0.95;
            const oldScale = this.stage.scale.x;
            const newScale = Math.max(1, Math.min(8, oldScale * scaleFactor));

            const rect = this.app.view.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const worldX = (mouseX - this.stage.x) / oldScale;
            const worldY = (mouseY - this.stage.y) / oldScale;

            this.stage.scale.set(newScale);

            this.stage.x = mouseX - worldX * newScale;
            this.stage.y = mouseY - worldY * newScale;

            const maxX = 0;
            const maxY = 0;
            const minX = this.app.renderer.width - this.app.renderer.width * newScale;
            const minY = this.app.renderer.height - this.app.renderer.height * newScale;

            this.stage.x = Math.min(maxX, Math.max(minX, this.stage.x));
            this.stage.y = Math.min(maxY, Math.max(minY, this.stage.y));

            this.app.view.style.cursor = newScale > 1 ? "grab" : "default";
        });

        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let stageStart = { x: 0, y: 0 };

        this.app.view.addEventListener('mousedown', (event) => {
            if (this.stage.scale.x <= 1) return;
            isDragging = true;
            this.app.view.style.cursor = "grabbing";
            dragStart = { x: event.clientX, y: event.clientY };
            stageStart = { x: this.stage.x, y: this.stage.y };
        });

        window.addEventListener('mousemove', (event) => {
            if (!isDragging) return;

            const dx = event.clientX - dragStart.x;
            const dy = event.clientY - dragStart.y;

            this.stage.x = stageStart.x + dx;
            this.stage.y = stageStart.y + dy;

            const scale = this.stage.scale.x;
            const minX = this.app.renderer.width - this.app.renderer.width * scale;
            const minY = this.app.renderer.height - this.app.renderer.height * scale;

            this.stage.x = Math.min(0, Math.max(minX, this.stage.x));
            this.stage.y = Math.min(0, Math.max(minY, this.stage.y));
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.app.view.style.cursor = "grab";
            }
        });
    }

    updateData(newData) {
        const filtered = newData.filter(d => d.value > 0);
        const minChange = Math.min(...filtered.map(d => d.change));
        const maxChange = Math.max(...filtered.map(d => d.change));
        this.data = filtered.map(d => ({
            ...d,
            color: colorScale(d.change, minChange, maxChange)
        }));

        this.render();
    }

    render() {
        this.stage.removeChildren();

        const width = this.app.renderer.width;
        const height = this.app.renderer.height;
        const totalValue = this.data.reduce((sum, d) => sum + d.value, 0);
        let x = 0, y = 0, w = width, h = height;
        const items = [...this.data];
        const stack = [{ items, x, y, w, h }];

        while (stack.length > 0) {
            const { items, x, y, w, h } = stack.pop();

            if (items.length === 0) continue;
            if (items.length === 1) {
                const d = items[0];
                const area = (d.value / totalValue) * width * height;
                const rw = w;
                const rh = area / rw;

                this.drawBlock(d, x, y, rw, rh);
                continue;
            }

            const total = items.reduce((sum, d) => sum + d.value, 0);
            let acc = 0, i = 0;
            for (; i < items.length; i++) {
                acc += items[i].value;
                if (acc >= total / 2) break;
            }

            const left = items.slice(0, i + 1);
            const right = items.slice(i + 1);

            const areaLeft = (left.reduce((s, d) => s + d.value, 0) / totalValue) * width * height;

            if (w >= h) {
                const splitW = areaLeft / h;
                stack.push({ items: right, x: x + splitW, y, w: w - splitW, h });
                stack.push({ items: left, x, y, w: splitW, h });
            } else {
                const splitH = areaLeft / w;
                stack.push({ items: right, x, y: y + splitH, w, h: h - splitH });
                stack.push({ items: left, x, y, w, h: splitH });
            }
        }
    }
    drawBlock(item, x, y, w, h) {
        const rect = new PIXI.Graphics();
        const color = item.color;
        rect.beginFill(color);
        rect.lineStyle(1, 0x111111, 0.25);
        rect.drawRect(x, y, w, h);
        rect.endFill();

        rect.interactive = true;
        rect.on('mouseover', (event) => {
            rect.alpha = 0.7;
            showTooltip(this.tooltip, formatTooltip(item), event.data.global.x, event.data.global.y);
        });

        rect.on('mouseout', () => {
            rect.alpha = 1;
            hideTooltip(this.tooltip);
        });

        rect.on('mousemove', (event) => {
            showTooltip(this.tooltip, formatTooltip(item), event.data.global.x, event.data.global.y);
        });
        function formatTooltip(item) {
            const cap = item.market_cap.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
            });
            const vol = item.volume_24h.toLocaleString('en-US', {
                style: 'decimal',
                maximumFractionDigits: 2
            });

            const isPositive = item.change >= 0;
            const changeColor = isPositive ? '#6f0' : '#ff5858';
            const change = `<span style="color: ${changeColor}; font-weight: bold;">${isPositive ? '+' : ''}${item.change.toFixed(2)}%</span>`;

            return `
                <b style="font-size: 1.2em;">${item.name}</b><br>
                Price: $${item.price}<br>
                Change: ${change}<br>
                Market Cap: ${cap}<br>
                Volume 24h: ${vol}
            `;
        }
        this.stage.addChild(rect);

        const minDim = Math.min(w, h);
        if (minDim < 5) return;

        const desiredSize = Math.min(44, minDim / 5);
        const scale = desiredSize / 150;
        const priceScale = scale * 0.7;
        const perScale = scale * 0.6;

        const addText = (text, opts) => {
            const txt = new PIXI.BitmapText(text, opts);
            txt.scale.set(opts.scale);
            txt.updateText();
            txt.pivot.set(txt.textWidth / 2, txt.textHeight / 2);
            txt.x = opts.x;
            txt.y = opts.y;
            txt.alpha = opts.alpha ?? 1;
            this.stage.addChild(txt);
        };

        const cx = x + w / 2;
        const cy = y + h / 2;

        // Тикер
        addText(item.name, {
            fontName: "robotoBig",
            tint: 0x000000,
            scale,
            x: cx,
            y: cy + desiredSize * -0.5,
            alpha: 0.6
        });
        addText(item.name, {
            fontName: "robotoBig",
            tint: 0xffffff,
            scale,
            x: cx,
            y: cy + desiredSize * -0.55
        });

        // Цена
        const priceStr = `$${item.price}`;
        addText(priceStr, {
            fontName: "robotoBig",
            tint: 0x000000,
            scale: priceScale,
            x: cx,
            y: cy + desiredSize * 0.45,
            alpha: 0.6
        });
        addText(priceStr, {
            fontName: "robotoBig",
            tint: 0xffffff,
            scale: priceScale,
            x: cx,
            y: cy + desiredSize * 0.4
        });

        // Процент изменения
        const sign = item.change > 0 ? "+" : "";
        const changeStr = `${sign}${item.change.toFixed(2)}%`;
        const changeColor = item.change >= 0 ? 0xaaff00 : 0xff8f8f;
        addText(changeStr, {
            fontName: "robotoBig",
            tint: 0x000000,
            scale: perScale,
            x: cx,
            y: cy + desiredSize * 1.18,
            alpha: 0.6
        });
        addText(changeStr, {
            fontName: "robotoBig",
            tint: changeColor,
            scale: perScale,
            x: cx,
            y: cy + desiredSize * 1.13
        });
    }
}