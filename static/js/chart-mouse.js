// chart-mouse.js
import { zoomX, zoomY, pan } from './chart-zoom.js';

export class Mouse {
  constructor(app, config, getState, args) {
    this.app = app;
    this.config = config;
    this.getState = getState;

    // безопасное извлечение без дефолтных самоссылок
    this.render = args?.render;
    this.update = args?.update;
    this.chartCore = args?.chartCore;

    // инструменты
    this.zoomX = zoomX;
    this.zoomY = zoomY;
    this.pan = pan;

    // состояния
    this.dragging = false;
    this.resizingX = false;
    this.resizingY = false;
    this.lastX = 0;
    this.lastY = 0;
    this.movedScale = false;
    this.centerX = 0;
    this.centerY = 0;
    this.worldX0 = 0;
    this.worldY0 = 0;
    this.canvasH = 0;
    this.cw = (config.candles?.candleWidth ?? 6) + (config.spacing ?? 2);
    this.rafPending = false;
    this.debug = !!config.debugMouse;

    this.minScaleX = config.minScaleX ?? 0.2;
    this.maxScaleX = config.maxScaleX ?? 8;
    this.minScaleY = config.minScaleY ?? 0.2;
    this.maxScaleY = config.maxScaleY ?? 8;

    this.downX = 0;
    this.downY = 0;
    this.wasDrag = false;
    
    this.draggingIndicatorId = null;
    this.indicatorOffsets = new Map();
  }

  getRect() {
    const v = this.app?.view;
    return v ? v.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
  }

  inPlot(s, mx, my) {
    const L = s.layout; if (!L) return false;
    return mx >= L.plotX && mx <= L.plotX + L.plotW && my >= L.plotY && my <= L.plotY + L.plotH;
  }

  scheduleRender() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => { this.render?.(); this.rafPending = false; });
  }

  ensureStateSafe(s) {
    if (typeof s.scaleX !== 'number' || isNaN(s.scaleX)) s.scaleX = 1;
    if (typeof s.offsetX !== 'number' || isNaN(s.offsetX)) s.offsetX = 0;
    if (typeof s.scaleY !== 'number' || isNaN(s.scaleY)) s.scaleY = 1;
    if (typeof s.offsetY !== 'number' || isNaN(s.offsetY)) s.offsetY = 0;
  }

  onPointerDown = (e) => {
    const s = this.getState?.(); if (!s) return; this.ensureStateSafe(s);
    this.downX = e.clientX; this.downY = e.clientY; this.wasDrag = false;

    const r = this.getRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    this.movedScale = false; 
    this.centerX = r.width * 0.5; 
    this.centerY = r.height * 0.5; 
    this.canvasH = this.app?.renderer?.height || r.height;

    const L = s.layout; if (!L) return;
    const { bottomOffset, rightOffset } = L;

    const inPriceScale =
      x >= L.plotX + L.plotW && x <= L.width &&
      y >= L.plotY && y <= L.plotY + L.plotH;

    const inTimeScale =
      y >= L.height - bottomOffset && y <= L.height &&
      x >= L.plotX && x <= L.plotX + L.plotW;

    const inPlot =
      x >= L.plotX && x <= L.plotX + L.plotW &&
      y >= L.plotY && y <= L.plotY + L.plotH;

    const inIndicators =
      y >= L.plotY + L.plotH && y <= L.height - L.bottomOffset &&
      x >= L.plotX && x <= L.plotX + L.plotW;

    if (inPriceScale) {
      this.resizingY = true;
      this.worldY0 = (this.centerY - s.offsetY) / (this.canvasH * s.scaleY);
      this.app.view.style.cursor = 'ns-resize';
    }
    else if (inTimeScale) {
      this.resizingX = true;
      const spacing = L.spacing ?? this.cw;
      this.worldX0 = (this.centerX - s.offsetX) / (spacing * s.scaleX);
      this.app.view.style.cursor = 'ew-resize';
    }
    else if (inPlot) {
      this.dragging = true;
      this.app.view.style.cursor = 'grabbing';
    }
    else if (inIndicators) {
      this.draggingIndicators = true;
      this.app.view.style.cursor = 'grabbing';
      const idx = this.chartCore?.indicators?.hitTestIndicator?.(y);
      if (idx) {
        this.draggingIndicatorId = idx;
      }
    }
    else {
      // проверка оффсайд‑зоны индикаторов (правый 70px столбец каждого индикатора)
      for (const [id, obj] of this.chartCore?.indicators?.activeEntries?.() || []) {
        const box = obj._offsideBox;
        if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          this.resizingIndicatorId = id;
          this.app.view.style.cursor = 'ns-resize';
          break;
        }
      }
    }

    this.lastX = e.clientX; this.lastY = e.clientY;
  };

  onPointerMove = (e) => {
    if (this.ignoreNextMove) {
      this.ignoreNextMove = false;
      return;
    }    
    console.log('MOVE', e.type, 'buttons=', e.buttons, 'dx/dy=', e.movementX, e.movementY, 
              'dragging=', this.dragging, 
              'resizingIndicatorId=', this.resizingIndicatorId);
    
    const s = this.getState?.(); if (!s) return; this.ensureStateSafe(s);
    if (Math.abs(e.clientX - this.downX) > 3 || Math.abs(e.clientY - this.downY) > 3) this.wasDrag = true;

    const r = this.getRect(), dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY; 
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const L = s.layout; if (!L) return;
    const { bottomOffset, rightOffset } = L;

    const inPriceScale =
      mx >= L.plotX + L.plotW && mx <= L.width &&
      my >= L.plotY && my <= L.plotY + L.plotH;

    const inTimeScale =
      my >= L.height - bottomOffset && my <= L.height &&
      mx >= L.plotX && mx <= L.plotX + L.plotW;

    const inPlotX = mx >= L.plotX && mx <= L.plotX + L.plotW;
    const inPlotFull =
      mx >= L.plotX && mx <= L.plotX + L.plotW &&
      my >= L.plotY && my <= L.plotY + L.plotH;

    if (this.dragging) {
      if (!inPlotFull) { 
        this.dragging = false; 
        this.app.view.style.cursor = 'default'; 
        return; 
      }
      const p = this.pan?.({ offsetX: s.offsetX, offsetY: s.offsetY, dx, dy }); 
      if (p) { s.offsetX = p.offsetX; s.offsetY = p.offsetY; } 
      this.render?.(); 
      return;
    }

    // только горизонталь в индикаторе bottom
    if (this.draggingIndicators) {
      // горизонталь — глобально
      s.offsetX += dx;
      // вертикаль — только для конкретного индикатора
      if (this.draggingIndicatorId) {
        const obj = this.chartCore?.indicators?.get(this.draggingIndicatorId);
        if (obj) {
          const prev = this.indicatorOffsets.get(this.draggingIndicatorId) || 0;
          this.indicatorOffsets.set(this.draggingIndicatorId, prev + dy);
          obj.localOffsetY = prev + dy;
        }
      }
      this.render?.();
      return;
    }

    // 🔹 drag‑zoom для индикатора через offside‑зону
    if (this.resizingIndicatorId && dy !== 0) {
      const factor = 1 - dy * 0.01;
      this.chartCore.indicators.setScaleOne(this.resizingIndicatorId, factor);
      return;
    }

    if (this.resizingX && dx !== 0) {
      if (!inTimeScale) return;
      this.movedScale = true; 
      const spacing = L.spacing ?? this.cw; 
      const f = 1 - dx * 0.05;
      s.scaleX = Math.min(this.maxScaleX, Math.max(this.minScaleX, s.scaleX * f)); 
      s.offsetX = this.centerX - this.worldX0 * (spacing * s.scaleX);
      this.render?.(); 
      return;
    }

    if (this.resizingY && dy !== 0) {
      if (!inPriceScale) return;
      this.movedScale = true; 
      const f = 1 - dy * 0.05;
      s.scaleY = Math.min(this.maxScaleY, Math.max(this.minScaleY, s.scaleY * f)); 
      s.offsetY = this.centerY - this.worldY0 * (this.canvasH * s.scaleY);
      this.render?.(); 
      return;
    }

    if (!this.dragging && !this.resizingX && !this.resizingY && !this.resizingIndicatorId) {
      if (inPriceScale) {
        this.app.view.style.cursor = 'ns-resize';
      }
      else if (inTimeScale) {
        this.app.view.style.cursor = 'ew-resize';
      }
      else {
        // проверка оффсайд‑зоны индикаторов
        let inOffside = false;
        for (const [, obj] of this.chartCore?.indicators?.activeEntries?.() || []) {
          const box = obj._offsideBox;
          if (box && mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
            inOffside = true;
            break;
          }
        }
        if (inOffside) this.app.view.style.cursor = 'ns-resize';
        else this.app.view.style.cursor = 'default';
      }
    }

    // Hover по свечам
    if (!L || !s.candles?.length) return;
    s.mouseX = mx; s.mouseY = my;

    if (!inPlotX) {
      this.update?.(null);
      this.chartCore?.indicators?.updateHoverAll?.(null, null);
      return;
    }
    const t = L.screenToTime(mx), C = s.candles;
    const idx = Math.min(Math.max(Math.floor((t - C[0].time) / L.tfMs), 0), C.length - 1);
    if (idx === s._lastHoverIdx) return;
    s._lastHoverIdx = idx;
    this.update?.(C[idx]);
    this.chartCore?.indicators?.updateHoverAll(C[idx], idx);
  };

  onPointerUp = () => { 
    
    console.log('UP', 'dragging=', this.dragging, 
              'resizingIndicatorId=', this.resizingIndicatorId);
    
    this.dragging = this.resizingX = this.resizingY = this.draggingIndicators = false;
    this.draggingIndicatorId = null;
    this.resizingIndicatorId = null;
    if (this.app?.view) this.app.view.style.cursor = 'default';
  };
  
  onPointerLeave = () => { 
    this.dragging = this.resizingX = this.resizingY = this.draggingIndicators = false;
    this.draggingIndicatorId = null;
    if (this.app?.view) this.app.view.style.cursor = 'default';
  };

  onWheel = (e) => {
    const s = this.getState?.(); if (!s) return; this.ensureStateSafe(s);
    e.preventDefault();

    const r = this.getRect(), mx = e.clientX - r.left, my = e.clientY - r.top, L = s.layout; if (!L) return;
    const inPriceScale = mx >= L.plotX + L.plotW && mx <= L.width && my >= L.plotY && my <= L.plotY + L.plotH;
    const inTimeScale  = my >= L.plotY + L.plotH && my <= L.height && mx >= L.plotX && mx <= L.plotX + L.plotW;

    //  горизонтальный диапазон графика (plot + индикаторы + нижняя шкала)
    const inPlotX = mx >= L.plotX && mx <= L.plotX + L.plotW;

    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);

    // горизонтальный скролл — панорамирование по всей высоте графика
    if (inPlotX && ax > ay + 2) {
      s.offsetX -= e.deltaX;
      this.render?.();
      return;
    }

    // вертикальный скролл — зум (оставляем как было)
    if (ay > ax + 2) {
      const f = Math.exp(-e.deltaY * 0.005);

      // Y‑зум: правая шкала (всегда простой зум из центра)
      if (inPriceScale) {
        const centerY = L.plotY + L.plotH / 2;
        const worldY0 = (centerY - s.offsetY) / (L.plotH * s.scaleY);
        const newScaleY = Math.min(this.maxScaleY, Math.max(this.minScaleY, s.scaleY * f));
        const newOffsetY = centerY - worldY0 * (L.plotH * newScaleY);
        s.scaleY = newScaleY;
        s.offsetY = newOffsetY;
        this.render?.();
        return;
      }

      // X‑зум: нижняя шкала или график без Shift
      if (inTimeScale || (inPlotX && !e.shiftKey)) {
        const z = this.zoomX?.({
          mx,
          scaleX: s.scaleX,
          offsetX: s.offsetX,
          config: this.config,
          direction: f
        });
        if (z) { s.scaleX = z.scaleX; s.offsetX = z.offsetX; }
        this.render?.();
        return;
      }
      // Проверка оффсайд‑зоны индикаторов
      for (const [id, obj] of this.chartCore?.indicators?.activeEntries?.() || []) {
        const box = obj._offsideBox;
        if (!box) continue;
        if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
          const factor = Math.exp(-e.deltaY * 0.005);
          this.chartCore.indicators.setScaleOne(id, factor);
          return;
        }
      }

      // Y‑зум из центра основного графика при Shift (как было)
      const inMainPlotY = my >= L.plotY && my <= L.plotY + L.plotH;
      if (inMainPlotY && e.shiftKey) {
        const centerY = L.plotY + L.plotH / 2;
        const worldY0 = (centerY - s.offsetY) / (L.plotH * s.scaleY);
        const newScaleY = Math.min(this.maxScaleY, Math.max(this.minScaleY, s.scaleY * f));
        const newOffsetY = centerY - worldY0 * (L.plotH * newScaleY);
        s.scaleY = newScaleY;
        s.offsetY = newOffsetY;
        this.render?.();
        return;
      }
    }
  };

  onClick = (e) => {
    // быстрый клик без движения — ничего
    const dx = Math.abs(e.clientX - this.downX);
    const dy = Math.abs(e.clientY - this.downY);
    if (dx < 3 && dy < 3) return;

    const s = this.getState?.(); if (!s) return; 
    this.ensureStateSafe(s);
    if (this.movedScale) { this.movedScale = false; return; }

    const r = this.getRect(), x = e.clientX - r.left, y = e.clientY - r.top, factor = e.shiftKey ? 0.9 : 1.1, L = s.layout; 
    if (!L) return;

    const bottomOffset = this.config.bottomOffset;
    const rightOffset  = this.config.rightOffset;    
    
    const inPriceScale = x >= L.plotX + L.plotW && x <= L.width && y >= L.plotY && y <= L.plotY + L.plotH;
    const inTimeScale = y >= L.height - bottomOffset && y <= L.height && x >= 0 && x <= L.width - rightOffset;

    if (inPriceScale) {
      // шаговый Y‑зум из центра
      const centerY = L.plotY + L.plotH / 2;
      const worldY0 = (centerY - s.offsetY) / (L.plotH * s.scaleY);
      const newScaleY = Math.min(this.maxScaleY, Math.max(this.minScaleY, s.scaleY * factor));
      const newOffsetY = centerY - worldY0 * (L.plotH * newScaleY);
      s.scaleY = newScaleY;
      s.offsetY = newOffsetY;
      this.scheduleRender();
      return;
    }

    if (inTimeScale) {
      // шаговый X‑зум из центра
      const mxCenter = L.plotX + L.plotW / 2;
      const z = this.zoomX?.({
        mx: mxCenter,
        scaleX: s.scaleX,
        offsetX: s.offsetX,
        config: this.config,
        direction: factor
      });
      if (z) { 
        s.scaleX = z.scaleX; 
        s.offsetX = z.offsetX; 
      }
      this.scheduleRender();
      return;
    }
  };

  // двойной клик по plot → скрыть все индикаторы
  onDblClick = (e) => {
    const s = this.getState?.(); if (!s) return;
    const L = s.layout; if (!L) return;

    const r = this.getRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    // двойной клик должен срабатывать только в plot‑области
    const inPlot =
      x >= L.plotX && x <= L.plotX + L.plotW &&
      y >= L.plotY && y <= L.plotY + L.plotH;

    if (!inPlot) return;

    // 🔹 переключаем fullscreen‑режим (убираем/возвращаем только bottom‑индикаторы)
    this.chartCore?.indicators?.toggleFullscreen();
  };

  init() {
    const v = this.app?.view;
    if (!v) return;

    try { v.style.touchAction = 'none'; } catch {}

    v.addEventListener('pointerdown', this.onPointerDown);
    v.addEventListener('pointermove', this.onPointerMove);
    v.addEventListener('pointerup', this.onPointerUp);
    v.addEventListener('pointerleave', this.onPointerLeave);
    v.addEventListener('wheel', this.onWheel, { passive: false });
    v.addEventListener('click', this.onClick);
    v.addEventListener('dblclick', this.onDblClick);
  }

  destroy() {
    const v = this.app?.view;
    if (!v) return;

    v.removeEventListener('pointerdown', this.onPointerDown);
    v.removeEventListener('pointermove', this.onPointerMove);
    v.removeEventListener('pointerup', this.onPointerUp);
    v.removeEventListener('pointerleave', this.onPointerLeave);
    v.removeEventListener('wheel', this.onWheel, { passive: false });
    v.removeEventListener('click', this.onClick);
    v.removeEventListener('dblclick', this.onDblClick);
  }
}
