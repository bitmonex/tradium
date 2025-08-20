// chart-scale.js

import { ChartConfig }         from './chart-config.js';
import { getTimeTicks, getPriceTicks } from './chart-grid.js';

export class ChartScales {
  /**
   * @param {PIXI.Container} container — куда рисуем шкалы
   * @param {Object} layout  — из createLayout
   * @param {Object} settings — конфиг из chart-core
   */
  constructor(container, layout, settings) {
    this.container = container;
    this.layout    = layout;
    this.settings  = settings;

    // хранение предыдущих параметров для решения, когда нужно пересоздать тики
    this._cache = { ticksKey: null };

    // слои: фон, тики, лейблы
    this._bg     = new PIXI.Graphics();
    this._gfx    = new PIXI.Graphics();
    this._labels = new PIXI.Container();

    container.addChild(this._bg, this._gfx, this._labels);
    container.sortableChildren = true;

    // сюда будем класть готовые массивы
    this._timeTicks  = [];
    this._priceTicks = [];
  }

  update() {
    const L   = this.layout;
    const cfg = this.settings;

    if (!cfg.grid.gridEnabled)                    return;
    if (!cfg.scales.scaleTime && !cfg.scales.scalePrice) return;

    // ключ для определения, менялась ли область или параметры
    const ticksKey = [
      L.width, L.height,
      L.scaleX, L.scaleY,
      L.offsetX, L.offsetY,
      cfg.scales.scaleTime,
      cfg.scales.scalePrice
    ].join('|');

    // пересоздаём тики только когда что-то действительно изменилось
    if (this._cache.ticksKey !== ticksKey) {
      this._cache.ticksKey = ticksKey;
      this._timeTicks  = cfg.scales.scaleTime  ? getTimeTicks(L)  : [];
      this._priceTicks = cfg.scales.scalePrice ? getPriceTicks(L) : [];
    }

    // очистка предыдущего рендера
    this._bg.clear();
    this._gfx.clear();
    this._labels.removeChildren();

    const bgColor = PIXI.utils.string2hex(cfg.scales.scaleBG);

    // фон временной шкалы (снизу)
    if (cfg.scales.scaleTime) {
      const y0 = L.height - cfg.bottomOffset;
      const w  = L.width  - cfg.rightOffset;
      this._bg.beginFill(bgColor);
      this._bg.drawRect(0, y0, w, cfg.bottomOffset);
      this._bg.endFill();
    }

    // фон ценовой шкалы (справа)
    if (cfg.scales.scalePrice) {
      const x0 = L.width - cfg.rightOffset;
      const h  = L.height - cfg.bottomOffset;
      this._bg.beginFill(bgColor);
      this._bg.drawRect(x0, 0, cfg.rightOffset, h);
      this._bg.endFill();
    }

    // рисуем тики и лейблы
    if (cfg.scales.scaleTime)  this._drawTimeScale(L, cfg);
    if (cfg.scales.scalePrice) this._drawPriceScale(L, cfg);
  }

  _drawTimeScale(L, cfg) {
    const style = new PIXI.TextStyle({
      fontFamily: ChartConfig.default.chartFont,
      fontSize:   cfg.scales.scaleFontSize,
      fontWeight: ChartConfig.default.chartFontWeight,
      fill:       cfg.scales.scaleTickColor
    });

    const halfCandle = (L.config.candleWidth * L.scaleX) / 2;
    const y0         = L.height - cfg.bottomOffset;
    let lastX        = -Infinity;

    for (const t of this._timeTicks) {
      // «магнитим» x к центру свечи
      const ts  = L.screen2t(t.x);
      const idx = Math.round((ts - (L.candles[0]?.time || 0)) / L.tfMs);
      const x0  = L.timestampToX(idx) + halfCandle;

      if (x0 < 0 || x0 > L.width - cfg.rightOffset) continue;
      if (x0 - lastX < cfg.scales.minLabelSpacing)  continue;
      lastX = x0;

      this._gfx
        .lineStyle(1, PIXI.utils.string2hex(cfg.scales.scaleTickColor))
        .moveTo(x0,   y0)
        .lineTo(x0,   y0 + 6);

      const label = new PIXI.Text(t.label, style);
      label.x = x0 - label.width / 2;
      label.y = y0 + 8;
      this._labels.addChild(label);
    }
  }

  _drawPriceScale(L, cfg) {
    const style = new PIXI.TextStyle({
      fontFamily: ChartConfig.default.chartFont,
      fontSize:   cfg.scales.scaleFontSize,
      fontWeight: ChartConfig.default.chartFontWeight,
      fill:       cfg.scales.scaleTickColor
    });

    const priceX  = L.width - cfg.rightOffset;
    const tickLen = 6;
    const textGap = 4;
    const minGap  = cfg.scales.minLabelSpacing;
    const maxY    = L.height - cfg.bottomOffset;

    // сортируем по Y сверху вниз
    const ticks = this._priceTicks.slice().sort((a, b) => a.y - b.y);
    const first = ticks[0];
    const last  = ticks[ticks.length - 1];

    let lastY = -Infinity;
    for (const p of ticks) {
      const y = Math.round(p.y);
      if (y < 0 || y > maxY)          continue;
      const isEdge = (p === first || p === last);
      if (!isEdge && y - lastY < minGap) continue;
      lastY = y;

      this._gfx
        .lineStyle(1, PIXI.utils.string2hex(cfg.scales.scaleTickColor))
        .moveTo(priceX,     y)
        .lineTo(priceX + tickLen, y);

      const label = new PIXI.Text(p.label, style);
      label.x = priceX + tickLen + textGap;
      label.y = y - label.height / 2;
      this._labels.addChild(label);
    }
  }
}
