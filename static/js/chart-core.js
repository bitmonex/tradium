import { ChartConfig } from './chart-config.js';
import { createLayout } from './chart-layout.js';
import { FPS } from './chart-fps.js';
import { OHLCV } from './chart-ohlcv.js';
import { ChartScales } from './chart-scale.js';
import { renderGrid } from "./chart-grid-render.js";
import { Mouse } from './chart-mouse.js';
import { Indicators } from './chart-indicators.js';
import { detectTimeframe } from './chart-tf.js';

PIXI.Text.defaultStyle = new PIXI.TextStyle({
  fontFamily: ChartConfig.default.chartFont,
  fontSize: ChartConfig.default.chartFontSize,
  fontWeight: ChartConfig.default.chartFontWeight
});

export function createChartCore(container) {
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 150;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let candles = [];
    let candleSprites = [];
    let lastRenderState = {};
    let cursorPos = { x: -1, y: -1 };
    let ohlcv = null;
    let indicator = null;
    let mouseHandlers = null;
    let isTouching = false;
    let app = new PIXI.Application({
        resizeTo: container,
        backgroundColor: Number(ChartConfig.default.chartBG),
        antialias: true,
        autoDensity: true
    });
    const settings = window.chartSettings || {};
    container.appendChild(app.view);
    const config = {
        ...ChartConfig,
        candleWidth: 5,
        spacing: 2,
        minScaleX: 0.05,
        maxScaleX: 40,
        minScaleY: 0.1,
        maxScaleY: 40,
        rightOffset: 70,
        bottomOffset: 30
    };
    const group = new PIXI.Container();
    app.stage.addChild(group);
    group.sortableChildren = true;
    const candleLayer = new PIXI.Container();
    candleLayer.zIndex = 10;
    group.addChild(candleLayer);
    const viewportMask = new PIXI.Graphics();
    group.mask = viewportMask;
    app.stage.addChild(viewportMask);
    function drawCandles(layout) {
        const cw = config.candleWidth + config.spacing;
        const { width, height } = app.renderer;
        if (!candles?.length) return;
        const prices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const key = [scaleX, scaleY, offsetX, offsetY, candles.length].join('_');
        if (key === lastRenderState.key) return;
        lastRenderState.key = key;
        while (candleSprites.length < candles.length) {
            const g = new PIXI.Graphics();
            g.zIndex = 10;
            candleSprites.push(g);
            candleLayer.addChild(g);
        }
        for (let i = 0; i < candleSprites.length; i++) {
            const sprite = candleSprites[i];
            const c = candles[i];
            if (!c) {
                sprite.visible = false;
                continue;
            }
            const x = i * cw * scaleX + offsetX;
            if (x + config.candleWidth < 0 || x > width - config.rightOffset) {
                sprite.visible = false;
                continue;
            }
            const y = (val) => ((height - config.bottomOffset) * (1 - (val - min) / range)) * scaleY + offsetY;
            const buy = parseInt(ChartConfig.candles.candleBull);
            const sell = parseInt(ChartConfig.candles.candleBear);
            const color = c.close >= c.open ? sell : buy;
            sprite.clear();
            sprite.visible = true;
            sprite.lineStyle(1, color);
            sprite.beginFill(color);
            sprite.drawRect(
                x,
                Math.min(y(c.open), y(c.close)),
                config.candleWidth * scaleX,
                Math.max(1, Math.abs(y(c.close) - y(c.open)))
            );
            sprite.endFill();
            sprite.moveTo(x + (config.candleWidth * scaleX) / 2, y(c.high));
            sprite.lineTo(x + (config.candleWidth * scaleX) / 2, y(c.low));
        }
    }
    function render() {
        if (!app?.renderer?.view || !app.view?.width) return;
        if (!candles || !candles.length) return;
        if (settings.indicatorsEnabled === false) return;
        const layout = createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY, group); // ← изменено
        drawCandles(layout);
        renderGrid(app, layout, settings);
        updateScales();
        const gridLayer = group.children.find(c => c.__gridLayer);
        if (gridLayer) {
            gridLayer.zIndex = 0;
            group.sortChildren();
        }
        if (viewportMask) {
            viewportMask.clear();
            viewportMask.beginFill(0x000000);
            viewportMask.drawRect(0, 0, layout.width - config.rightOffset, layout.height - config.bottomOffset);
            viewportMask.endFill();
        }
        indicator?.render?.(layout);
    }


    function updateScales() {
        const layout = createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY);
        ChartScales(app, candles, layout);
    }
            
    function zoomAt(mx, direction = 1.1) {
        const cw = config.candleWidth + config.spacing;
        const worldX = (mx - offsetX) / (cw * scaleX);
        scaleX *= direction;
        scaleX = Math.max(config.minScaleX, Math.min(config.maxScaleX, scaleX));
        offsetX = mx - worldX * (cw * scaleX);
        render();
    }

    function zoomYAt(my, direction = 1.1) {
        const height = app.renderer.height;
        const worldY = (my - offsetY) / (height * scaleY);
        scaleY *= direction;
        scaleY = Math.max(config.minScaleY, Math.min(config.maxScaleY, scaleY));
        offsetY = my - worldY * (height * scaleY);
        render();
    }
            
    mouseHandlers = Mouse(app, config, {
      setTouching: (v) => { isTouching = v },
      getBounds: (e) => {
        const bounds = app.view.getBoundingClientRect();
        return e.clientX >= bounds.left &&
               e.clientX <= bounds.right - config.rightOffset &&
               e.clientY >= bounds.top &&
               e.clientY <= bounds.bottom - config.bottomOffset;
      },
      onDragStart: () => { dragging = true },
      onDragMove: (dx, dy) => {
        offsetX += dx;
        offsetY += dy;
        render();
        const layout = createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY);
        indicator?.render?.(layout);
      },
      onDragEnd: () => { dragging = false },
        onMouseUpdate: (e) => {
          const pos = app.renderer.plugins?.interaction?.mouse?.global;
          if (pos) {
            cursorPos.x = pos.x;
            cursorPos.y = pos.y;
          } else {
            cursorPos.x = e.offsetX;
            cursorPos.y = e.offsetY;
          }

          // 🔍 Найдём индекс свечи под курсором
          const cw = config.candleWidth + config.spacing;
          const index = Math.floor((cursorPos.x - offsetX) / (cw * scaleX));
          const candle = candles[index];

          if (ohlcv && candle) {
            ohlcv.render(candle);
          }

          render();
        },
        onWheelZoom: (e) => {
          const absX = Math.abs(e.deltaX);
          const absY = Math.abs(e.deltaY);

          if (absX > absY + 2) {
            // 🖐️ Панорамирование по горизонтали
            offsetX -= e.deltaX;
          } else if (absY > absX + 2) {
            // 🔍 Масштабирование
            const dir = e.deltaY < 0 ? 1.1 : 0.9;
            const sir = e.deltaY < 0 ? 1.5 : 0.5;

            if (e.shiftKey) {
              // ⬆️ Вертикальный масштаб из центра
              const rect = app.view.getBoundingClientRect();
              const centerY = rect.height / 2;
              zoomYAt(centerY, sir);
            } else {
              // ⬅️ Горизонтальный масштаб из курсора
              zoomAt(e.offsetX, dir);
            }
          }

          render();
        },

        zoomAt,
        zoomYAt
    });

    window.addEventListener("resize", () => {
        if (chartCore?.resize) {
            chartCore.resize();
        }
    });
    if (ChartConfig.fps?.fpsOn) {
        new FPS(app.stage);
    }
    const chartCore = {
        draw(data) {
            candles = data;
            if (ChartConfig.ohlcv?.ohlcvOn && candles.length) {
                const activeCandle = candles.at(-1);
                ohlcv = OHLCV({ ...config, group, chartSettings: settings }, candles);
                ohlcv.render(activeCandle);
            }
            const cw = config.candleWidth + config.spacing;
            const totalWidth = candles.length * cw * scaleX;
            const viewWidth = app.renderer.width;
            offsetX = viewWidth - config.rightOffset - totalWidth;
            offsetY = app.renderer.height / 2.8;
            indicator = Indicators({ group, app, config, candles });
            const layout = createLayout(app, config, candles, offsetX, offsetY, scaleX, scaleY);
            indicator.init(layout);
            if (ChartConfig.indicators.indicatorsEnabled) {
                indicator?.render?.(layout);
            }
            render();
        },
        destroy() {
            try {
                if (mouseHandlers) {
                    app.view.removeEventListener('mousedown', mouseHandlers.onMouseDown);
                    app.view.removeEventListener('wheel', mouseHandlers.onWheel);
                    window.removeEventListener('mouseup', mouseHandlers.onMouseUp);
                    window.removeEventListener('mousemove', mouseHandlers.onMouseMove);
                }
                app.destroy(true, { children: true });
            } catch (e) {
                console.warn("🧯 destroy: ошибка при очистке PIXI", e);
            }
            app = null;
        },
        resize() {
            if (!app || !app.renderer) return;
            const w = container.getBoundingClientRect().width;
            const h = container.getBoundingClientRect().height;
            app.renderer.resize(w, h);
            app.view.style.width = w + "px";
            app.view.style.height = h + "px";
            const oldScales = app.stage.children.filter(c => c.__isScaleLayer);
            for (const s of oldScales) {
                app.stage.removeChild(s);
                s.destroy({ children: true });
            }
            render();
            updateScales();
        },
        updateScales,
        zoomAt,
        zoomYAt,
        app
    };
    return chartCore;
}