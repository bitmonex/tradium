// chart-live.js

import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings }) {
  const { symbol } = chartSettings;
  const padX       = 8;
  const padY       = 4;

  // 1) линия (mask)
  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  // 2) overlay (над mask)
  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);

  // 3) общий TextStyle
  const baseStyle = createTextStyle(config, { fill: config.textColor });

  // тикер
  const tickerBg   = new PIXI.Graphics();
  const tickerText = new PIXI.Text(symbol, baseStyle);
  overlay.addChild(tickerBg, tickerText);

  // плашка цены + времени
  const boxBg     = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  function drawDotted(g, x1, y, x2, dotR = 1, gap = 4) {
    g.clear();
    g.beginFill(g._lineColor || 0xffffff);
    for (let x = x1; x < x2; x += dotR * 2 + gap) {
      g.drawCircle(x, y, dotR);
    }
    g.endFill();
  }

  function render(layout) {
    const { candles, width, height, scaleY, offsetY } = layout;
    if (!candles?.length) {
      line.clear();
      boxBg.clear();
      tickerBg.clear();
      return;
    }

    // определяем цену, направление и цвет
    const last = candles.at(-1);
    const prev = candles.at(-2) || last;
    const price = last.close;
    const isUp = price >= prev.close;
    const lineClr = isUp
      ? +config.priceUpColor
      : +config.priceDownColor;
    line._lineColor = lineClr;

    // рассчитываем y по цене
    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const plotH = height - config.bottomOffset;
    const rawY = plotH * (1 - (price - minP) / range);
    const y = rawY * scaleY + offsetY;

    // пунктирная линия вплотную к правому краю
    drawDotted(line, 0, y, width);

    // обновляем тексты
    priceText.text = price.toFixed(2);
    timerText.text = new Date().toLocaleTimeString();

    // размеры ценовой плашки
    const textW = Math.max(priceText.width, timerText.width);
    const boxW  = textW + padX * 2;
    const boxH  = priceText.height + timerText.height + padY * 3;

    // рисуем фон ценового бокса
    boxBg.clear();
    boxBg.beginFill(lineClr);
    boxBg.drawRect(0, 0, boxW, boxH);
    boxBg.endFill();

    // прижимаем ценовой бокс к правому краю
    const boxX = width - boxW;
    const boxY = y - boxH / 2;
    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);

    priceText.x = Math.round(boxX + padX);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + padX);
    timerText.y = Math.round(priceText.y + priceText.height + padY);

    // тикер строго слева от ценового блока
    tickerText.text = symbol;
    const tW = tickerText.width + padX * 2;
    const tH = tickerText.height + padY * 2;

    tickerBg.clear();
    tickerBg.beginFill(+config.tickerBgColor);
    tickerBg.drawRect(0, 0, tW, tH);
    tickerBg.endFill();

    tickerBg.x = Math.round(boxX - tW);
    tickerBg.y = Math.round(boxY);
    tickerText.x = Math.round(tickerBg.x + padX);
    tickerText.y = Math.round(tickerBg.y + padY);
  }

  return { render };
}
