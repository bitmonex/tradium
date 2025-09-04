// static/js/chart-live.js

import { createTextStyle } from './chart-utils.js';

/**
 * Рисует пунктирную линию текущей цены,
 * плашку с тикером, текущей ценой и таймером.
 */
export function LivePrice({ group, config, chartSettings }) {
  const { symbol } = chartSettings;
  const padX = 8, padY = 4;

  // 1) Слой для пунктирной линии
  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  // 2) Слой поверх всего для плашек
  //    Добавляем в app.stage (group.parent), чтобы не попал под маску
  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);

  // 3) Общий текстовый стиль
  //    Принудительно приводим config.textColor к числу
  const baseStyle = createTextStyle(config, {
    fill: +config.textColor
  });

  // 4) Плашка с тикером
  const tickerBg   = new PIXI.Graphics();
  const tickerText = new PIXI.Text(symbol, baseStyle);
  overlay.addChild(tickerBg, tickerText);

  // 5) Плашка с ценой и таймером
  const boxBg     = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  // Вспомогательная функция для рисования пунктиров
  function drawDotted(g, x1, y, x2, dotR = 1, gap = 4) {
    g.clear();
    // g._lineColor уже число 0xRRGGBB
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

    // Последняя свеча и цвет по тренду
    const last  = candles.at(-1);
    const prev  = candles.at(-2) || last;
    const price = last.close;
    const isUp  = price >= prev.close;
    const lineClr = isUp
      ? +config.priceUpColor
      : +config.priceDownColor;
    line._lineColor = lineClr;

    // Пересчёт Y-координаты
    const all = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...all), maxP = Math.max(...all);
    const range = maxP - minP || 1;
    const plotH = height - config.bottomOffset;
    const rawY  = plotH * (1 - (price - minP) / range);
    const y     = rawY * scaleY + offsetY;

    // Рисуем пунктирную линию
    drawDotted(line, 0, y, width);

    // Обновляем тексты
    priceText.text = price.toFixed(config.pricePrecision ?? 2);
    timerText.text = new Date().toLocaleTimeString();

    // Вычисляем размеры плашки
    const textW = Math.max(priceText.width, timerText.width);
    const boxW  = textW + padX * 2;
    const boxH  = priceText.height + timerText.height + padY * 3;

    // Фон ценового бокса
    boxBg.clear();
    boxBg.beginFill(lineClr);
    boxBg.drawRect(0, 0, boxW, boxH);
    boxBg.endFill();

    // Позиционируем ценовой бокс
    const boxX = width - boxW;
    const boxY = y - boxH / 2;
    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);

    priceText.x = Math.round(boxX + padX);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + padX);
    timerText.y = Math.round(priceText.y + priceText.height + padY);

    // Плашка тикера слева от ценового бокса
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

/**
 * Запускает WebSocket-поток и навешивает
 * обновления в chartCore и LivePrice.
 */
export function initLive(chartCore, { exchange, marketType, symbol, timeframe }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   =
    `${proto}://${location.host}/ws/kline`
    + `?exchange=${exchange}`
    + `&market_type=${marketType}`
    + `&symbol=${symbol}`
    + `&tf=${timeframe}`;

  console.info('WS connecting to:', url);
  const socket = new WebSocket(url);

  const livePrice = LivePrice({
    group:         chartCore.group,
    config:        chartCore.config,
    chartSettings: { symbol }
  });

  socket.addEventListener('message', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); }
    catch { return; }

    if (msg.type === 'kline_update') {
      chartCore.updateLast(msg.data);
      livePrice.render(chartCore.layout);
    }

    if (msg.type === 'kline_new') {
      const c = msg.data;
      chartCore.draw({
        candles: [...chartCore.state.candles, c],
        volumes: [...chartCore.state.volumes, { time: c.timestamp, value: c.volume }]
      });
    }
  });

  window.addEventListener('beforeunload', () => {
    socket.close();
    chartCore.destroy();
  });
}
