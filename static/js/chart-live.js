// chart-live.js
import { createTextStyle } from './chart-utils.js';

export function initLive(chartCore, { exchange, marketType, symbol, timeframe }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   = `${proto}://${location.host}/ws/kline`
              + `?exchange=${exchange}`
              + `&market_type=${marketType}`
              + `&symbol=${symbol}`
              + `&tf=${timeframe}`;

  const socket = new WebSocket(url);
  console.info('WS connecting to:', url);

  // инициализируем локальную функцию LivePrice
  const livePrice = LivePrice({
    group:         chartCore.app.stage,
    config:        chartCore.config,
    chartSettings: { symbol }
  });

  socket.addEventListener('message', event => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'history':
        chartCore.draw({ candles: msg.data });
        break;

      case 'kline_update':
        chartCore.updateLast(msg.data);
        livePrice.render(chartCore.layout);
        break;

      case 'kline_new':
        const newC = msg.data;
        chartCore.draw({
          candles: [...chartCore.state.candles, newC],
          volumes: [
            ...chartCore.state.volumes,
            { time: newC.timestamp, value: newC.volume }
          ]
        });
        break;
    }
  });

  window.addEventListener('beforeunload', () => {
    socket.close();
    chartCore.destroy();
  });
}


/**
 * Отрисовка линии и плашек последней цены
 */
function LivePrice({ group, config, chartSettings }) {
  const { symbol } = chartSettings;
  const padX       = 8;
  const padY       = 4;

  // слой для пунктирной линии
  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  // слой для плашек
  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);

  const baseStyle = createTextStyle(config, { fill: config.textColor });

  const tickerBg   = new PIXI.Graphics();
  const tickerText = new PIXI.Text(symbol, baseStyle);
  overlay.addChild(tickerBg, tickerText);

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

    const last = candles.at(-1);
    const prev = candles.at(-2) || last;
    const price = last.close;
    const isUp = price >= prev.close;
    const lineClr = isUp
      ? +config.priceUpColor
      : +config.priceDownColor;
    line._lineColor = lineClr;

    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const plotH = height - config.bottomOffset;
    const rawY = plotH * (1 - (price - minP) / range);
    const y = rawY * scaleY + offsetY;

    drawDotted(line, 0, y, width);

    priceText.text = price.toFixed(2);
    timerText.text = new Date().toLocaleTimeString();

    const textW = Math.max(priceText.width, timerText.width);
    const boxW  = textW + padX * 2;
    const boxH  = priceText.height + timerText.height + padY * 3;

    boxBg.clear();
    boxBg.beginFill(lineClr);
    boxBg.drawRect(0, 0, boxW, boxH);
    boxBg.endFill();

    const boxX = width - boxW;
    const boxY = y - boxH / 2;
    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);

    priceText.x = Math.round(boxX + padX);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + padX);
    timerText.y = Math.round(priceText.y + priceText.height + padY);

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
