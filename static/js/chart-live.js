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

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function render(layout) {
    const { candles, width, height, scaleY, offsetY, timeframe } = layout;
    if (!candles?.length) {
      line.clear();
      boxBg.clear();
      return;
    }

    const last = candles.at(-1);
    const price = last.price ?? last.close;

    // Безопасно определяем время закрытия текущей свечи
    // 1) если есть last.closeTime — используем его
    // 2) иначе вычисляем: (openTime || time || t) + timeframe
    const baseTime = last.openTime ?? last.time ?? last.t ?? null;
    const tfSec = Number.isFinite(timeframe) ? timeframe : 60;
    const computedClose = Number.isFinite(baseTime) ? (baseTime + tfSec) : null;
    lastCloseTime = Number.isFinite(last.closeTime) ? last.closeTime : computedClose;

    currentPrice = price;

    // Цвет по логике ядра
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
    const boxH = 45;

    // Плашка в тот же цвет
    boxBg.clear();
    boxBg.beginFill(currentColor);
    boxBg.drawRect(0, 0, boxW, boxH);
    boxBg.endFill();

    const boxX = width - boxW;
    const boxY = y - boxH / 1.5;
    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);

    // Сразу задаём текст — чтобы он был при первом рендере
    priceText.text = Number.isFinite(price) ? price.toFixed(2) : '';

    // Если не удалось определить closeTime — покажем 00:00, но без NaN
    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + (offsetSet ? serverOffset : 0);
      const timer = Math.max(lastCloseTime - now, 0);
      timerText.text = formatTime(timer);
    } else {
      timerText.text = '00:00';
    }

    // Центрируем текст
    priceText.x = Math.round(boxX + (boxW - priceText.width) / 2);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + (boxW - timerText.width) / 2);
    timerText.y = Math.round(priceText.y + priceText.height / 1.2);
  }

  function updatePrice(price, closeTime, serverTime) {
    currentPrice = price;
    if (Number.isFinite(closeTime)) {
      lastCloseTime = closeTime;
    }
    if (typeof serverTime === 'number' && !offsetSet) {
      const localNow = Math.floor(Date.now() / 1000);
      serverOffset = serverTime - localNow;
      offsetSet = true;
    }
  }

  function tick() {
    if (!Number.isFinite(currentPrice) || !Number.isFinite(lastCloseTime)) return;
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

  // Если layout уже готов — сразу отрисуем с таймером
  if (chartCore.layout) {
    live.render(chartCore.layout);
  }

  // Если есть свечи — сразу выставим цену/время и тикнем
  if (chartCore.state.candles.length) {
    const last = chartCore.state.candles.at(-1);
    const initialPrice = last.price ?? last.close;
    const initialClose = Number.isFinite(last.closeTime)
      ? last.closeTime
      : ((last.openTime ?? last.time ?? last.t ?? Math.floor(Date.now()/1000)) + (chartCore.state.timeframe || 60));

    live.updatePrice(initialPrice, initialClose, Math.floor(Date.now() / 1000));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);

  chartCore.app.ticker.add(() => {
    live.tick();
  });

  return live;
}
