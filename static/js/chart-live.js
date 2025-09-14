import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings }) {
  const symbol = chartSettings?.symbol ?? '???';
  const padX   = 8;
  const padY   = 4;

  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);

  const baseStyle = createTextStyle(config, { fill: 0xffffff });

  const tickerBg   = new PIXI.Graphics();
  const tickerText = new PIXI.Text(symbol, baseStyle);
  overlay.addChild(tickerBg, tickerText);

  const boxBg     = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  let lastCloseTime = null;
  let currentPrice = null;

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
    const price = last.price ?? last.close;
    lastCloseTime = last.closeTime;
    currentPrice = price;

    const isUp = price >= prev.close;
    const lineClr = isUp ? +config.priceUpColor : +config.priceDownColor;
    line._lineColor = lineClr;

    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const plotH = height - config.bottomOffset;
    const rawY = plotH * (1 - (price - minP) / range);
    const y = rawY * scaleY + offsetY;

    drawDotted(line, 0, y, width);

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

  function updatePrice(price, closeTime) {
    currentPrice = price;
    lastCloseTime = closeTime;
  }

  function tick() {
    if (!currentPrice || !lastCloseTime) return;
    const now = Math.floor(Date.now() / 1000);
    const timer = Math.max(lastCloseTime - now, 0);
    priceText.text = currentPrice.toFixed(2);
    timerText.text = String(timer);
  }

  return { render, updatePrice, tick };
}

function connectLiveSocket(chartCore, chartSettings, live) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const url = `ws://localhost:5002/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);

  // 🔹 сохраняем ссылку в ядре
  chartCore._livePriceSocket = ws;

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.price && data.closeTime) {
        live.updatePrice(data.price, data.closeTime);
      }
    } catch (err) {
      console.warn('[LiveSocket] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[LiveSocket] Disconnected');
    setTimeout(() => connectLiveSocket(chartCore, chartSettings, live), 1000);
  };
}

export function initLive(chartCore, chartSettings) {
  const config = chartCore.config;

  if (!chartSettings?.symbol) {
    console.warn('[initLive] chartSettings missing or invalid:', chartSettings);
    return;
  }

  const live = LivePrice({
    group: chartCore.group,
    config,
    chartSettings
  });

  chartCore.state.livePrice = live;

  if (chartCore.layout) {
    live.render(chartCore.layout);
  }

  connectLiveSocket(chartCore, chartSettings, live);

  chartCore.app.ticker.add(() => {
    live.tick();
  });

  return live;
}