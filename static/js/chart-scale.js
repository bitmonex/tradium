// chart-scale.js

import { ChartConfig }         from './chart-config.js';
import { getTimeTicks,
         getPriceTicks }      from './chart-grid.js';

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
    this._cache    = {};

    this._bg     = new PIXI.Graphics();
    this._gfx    = new PIXI.Graphics();
    this._labels = new PIXI.Container();

    container.addChild(this._bg, this._gfx, this._labels);
    container.sortableChildren = true;
  }

  update() {
    const L   = this.layout;
    const cfg = this.settings;

    if (!cfg.grid.gridEnabled)                    return;
    if (!cfg.scales.scaleTime && !cfg.scales.scalePrice) return;

    const key = [
      L.width, L.height,
      L.scaleX, L.scaleY,
      L.offsetX, L.offsetY,
      cfg.scales.scaleTime,
      cfg.scales.scalePrice,
      cfg.scales.scaleBG
    ].join('|');
    if (this._cache.key === key) return;
    this._cache.key = key;

    this._bg.clear();
    this._gfx.clear();
    this._labels.removeChildren();

    const bgColor = PIXI.utils.string2hex(cfg.scales.scaleBG);

    // Нижний фон
    if (cfg.scales.scaleTime) {
      const y0 = L.height - cfg.bottomOffset;
      const w  = L.width - cfg.rightOffset;
      this._bg.beginFill(bgColor);
      this._bg.drawRect(0, y0, w, cfg.bottomOffset);
      this._bg.endFill();
    }

    // Правый фон
    if (cfg.scales.scalePrice) {
      const x0 = L.width - cfg.rightOffset;
      const h  = L.height - cfg.bottomOffset;
      this._bg.beginFill(bgColor);
      this._bg.drawRect(x0, 0, cfg.rightOffset, h);
      this._bg.endFill();
    }

    if (cfg.scales.scaleTime)  this._drawTimeScale(L, cfg);
    if (cfg.scales.scalePrice) this._drawPriceScale(L, cfg);
  }

  _drawTimeScale(L, cfg) {
    const ticks      = getTimeTicks(L);
    const halfCandle = (L.config.candleWidth * L.scaleX) / 2;
    const y0         = L.height - cfg.bottomOffset;
    let lastX        = -Infinity;

    const style = new PIXI.TextStyle({
      fontFamily: ChartConfig.default.chartFont,
      fontSize:   cfg.scales.scaleFontSize,
      fontWeight: ChartConfig.default.chartFontWeight,
      fill:       cfg.scales.scaleTickColor
    });

    for (const t of ticks) {
      const ts  = L.screen2t(t.x);
      const idx = Math.round((ts - (L.candles[0]?.time||0)) / L.tfMs);
      const x0  = L.timestampToX(idx) + halfCandle;

      if (x0 < 0 || x0 > L.width - cfg.rightOffset) continue;
      if (x0 - lastX < cfg.scales.minLabelSpacing)  continue;
      lastX = x0;

      this._gfx
        .lineStyle(1, PIXI.utils.string2hex(cfg.scales.scaleTickColor))
        .moveTo(x0, y0)
        .lineTo(x0, y0 + 6);

      const label = new PIXI.Text(t.label, style);
      label.x = x0 - label.width / 2;
      label.y = y0 + 8;
      this._labels.addChild(label);
    }
  }

    _drawPriceScale(L, cfg) {
      // получаем и сортируем тики по возрастанию Y
      const rawTicks = getPriceTicks(L);
      const ticks = rawTicks.slice().sort((a, b) => a.y - b.y);

      const priceX   = L.width - cfg.rightOffset;
      const tickLen  = 6;
      const textGap  = 4;
      const minGap   = cfg.scales.minLabelSpacing;
      const maxY     = L.height - cfg.bottomOffset;

      // определим первый и последний тик
      const firstTick = ticks[0];
      const lastTick  = ticks[ticks.length - 1];

      let lastY = -Infinity;
      const style = new PIXI.TextStyle({
        fontFamily:  ChartConfig.default.chartFont,
        fontSize:    cfg.scales.scaleFontSize,
        fontWeight:  ChartConfig.default.chartFontWeight,
        fill:        cfg.scales.scaleTickColor
      });

      for (const p of ticks) {
        // округляем Y, чтобы сравнения были предсказуемы
        const y = Math.round(p.y);

        // пропускаем тики вне области графика
        if (y < 0 || y > maxY) continue;

        // для первого и последнего тика мин. расстояние не проверяем
        const isEdge = (p === firstTick || p === lastTick);

        // проверяем минимальный отступ от предыдущей метки
        if (!isEdge && y - lastY < minGap) continue;

        lastY = y;

        // рисуем шкалу (тик)
        this._gfx
          .lineStyle(1, PIXI.utils.string2hex(cfg.scales.scaleTickColor))
          .moveTo(priceX,     y)
          .lineTo(priceX + tickLen, y);

        // создаём и позиционируем текст
        const label = new PIXI.Text(p.label, style);
        label.x = priceX + tickLen + textGap;
        label.y = y - label.height / 2;
        this._labels.addChild(label);
      }
    }

}
