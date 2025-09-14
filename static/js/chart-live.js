import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings, chartCore }) {
  const symbol = chartSettings?.symbol ?? '???';
  const padX   = 8;
  const padY   = 4;

  if (chartCore?.state?.livePriceOverlay) {
    chartCore.state.livePriceOverlay.destroy({ children: true });
  }

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

  if (chartCore?.state) {
    chartCore.state.livePriceOverlay = overlay;
  }

  const baseStyle = createTextStyle(config, { fill: 0xffffff });

  const boxBg     = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  let lastCloseTime = null;
  let currentPrice = null;
  let serverOffset = 0;
  let offsetSet = false;

  function drawDotted(g, x1, y, x2, dotR = 0.5, gap = 4) {
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
    return;
  }

  const last = candles.at(-1);
  const price = last.price ?? last.close;
  lastCloseTime = last.closeTime;
  currentPrice = price;

  // Цвет по логике ядра: сравниваем close и open текущей свечи
  const upColor   = config.livePrice.priceUpColor;
  const downColor = config.livePrice.priceDownColor;
  const isUp = last.close >= last.open;
  const currentColor = isUp ? upColor : downColor;

  // Линия в цвет свечи
  line._lineColor = currentColor;

  // Координата линии
  const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  const plotH = height - config.bottomOffset;
  const rawY = plotH * (1 - (price - minP) / range);
  const y = rawY * scaleY + offsetY;

  drawDotted(line, 0, y, width);

  // Фиксированная ширина плашки
  const boxW = 70;
  const boxH = priceText.height + timerText.height + padY * 3;

  // Плашка в тот же цвет
  boxBg.clear();
  boxBg.beginFill(currentColor);
  boxBg.drawRect(0, 0, boxW, boxH);
  boxBg.endFill();

  const boxX = width - boxW;
  const boxY = y - boxH / 2;
  boxBg.x = Math.round(boxX);
  boxBg.y = Math.round(boxY);

  // Центрируем текст
  priceText.x = Math.round(boxX + (boxW - priceText.width) / 2);
  priceText.y = Math.round(boxY + padY);
  timerText.x = Math.round(boxX + (boxW - timerText.width) / 2);
  timerText.y = Math.round(priceText.y + priceText.height + padY);
}

  function updatePrice(price, closeTime, serverTime) {
    currentPrice = price;
    lastCloseTime = closeTime;

    if (typeof serverTime === 'number' && !offsetSet) {
      const localNow = Math.floor(Date.now() / 1000);
      serverOffset = serverTime - localNow;
      offsetSet = true;
    }
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function tick() {
    if (!currentPrice || !lastCloseTime) return;
    const now = Math.floor(Date.now() / 1000) + serverOffset;
    const timer = Math.max(lastCloseTime - now, 0);
    priceText.text = currentPrice.toFixed(2);
    timerText.text = formatTime(timer);
  }

  return { render, updatePrice, tick, symbol };
}

function connectLiveSocket(chartCore, chartSettings, live) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const url = `ws://localhost:5002/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);

  chartCore._livePriceSocket = ws;

  ws.onmessage = (event) => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(event.data);
      if (typeof data.price === 'number' && typeof data.closeTime === 'number') {
        live.updatePrice(data.price, data.closeTime, data.serverTime);
      }
    } catch (err) {
      console.warn('[LiveSocket] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[LiveSocket] Disconnected');
    if (chartCore._alive) {
      setTimeout(() => connectLiveSocket(chartCore, chartSettings, live), 1000);
    }
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
    chartSettings,
    chartCore
  });

  chartCore.state.livePrice = live;

  if (chartCore.layout) {
    live.render(chartCore.layout);
  }

  if (chartCore.state.candles.length) {
    const last = chartCore.state.candles.at(-1);
    live.updatePrice(last.price ?? last.close, last.closeTime, Math.floor(Date.now() / 1000));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);

  chartCore.app.ticker.add(() => {
    live.tick();
  });

  return live;
}
