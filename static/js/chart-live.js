//chart-live.js
import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings, chartCore }) {
  const padX = 8, padY = 4;
  const symbol = chartSettings?.symbol ?? '???';

  // Сносим старый overlay
  chartCore?.state?.livePriceOverlay?.destroy?.({ children: true });

  // Слой линии
  const lineLayer = new PIXI.Container(); lineLayer.sortableChildren = true; lineLayer.zIndex = 100; group.addChild(lineLayer);
  const line = new PIXI.Graphics(); lineLayer.addChild(line);

  // Overlay поверх графика
  const overlay = new PIXI.Container(); overlay.sortableChildren = true; overlay.zIndex = 101; group.parent.addChild(overlay);
  if (chartCore?.state) chartCore.state.livePriceOverlay = overlay;

  // Текст и фон
  const baseStyle = createTextStyle(config, { fill: +(config.textColor ?? 0xffffff) });
  const boxBg = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  let lastCloseTime = null, currentPrice = null, serverOffset = 0, offsetSet = false;

  const drawDotted = (g, x1, y, x2, dotR = 1, gap = 4) => {
    g.clear().beginFill(g._lineColor || 0xffffff);
    for (let x = x1; x < x2; x += dotR * 2 + gap) g.drawCircle(x, y, dotR);
    g.endFill();
  };

  const formatTime = sec => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const getCandleColor = (last, price) => {
    const upColor = +(config.priceUpColor ?? config.livePrice?.priceUpColor ?? 0x2ecc71);
    const downColor = +(config.priceDownColor ?? config.livePrice?.priceDownColor ?? 0xe74c3c);
    return (last.close ?? price) >= (last.open ?? price) ? upColor : downColor;
  };

  const calcY = (candles, price, layout) => {
    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices), maxP = Math.max(...allPrices), range = maxP - minP || 1;
    const plotH = layout.height - (config.bottomOffset ?? 0);
    const rawY = plotH * (1 - (price - minP) / range);
    return rawY * layout.scaleY + layout.offsetY;
  };

  const drawBox = (y, price, color, width) => {
    priceText.text = Number.isFinite(price) ? price.toFixed(2) : '';
    const textW = Math.max(priceText.width, timerText.width);
    const boxW = Math.max(70, textW + padX * 2);
    const boxH = Math.max(40, priceText.height + timerText.height + padY * 3);
    boxBg.clear().beginFill(color).drawRect(0, 0, boxW, boxH).endFill();
    const boxX = width - boxW, boxY = y - boxH / 2;
    boxBg.x = Math.round(boxX); boxBg.y = Math.round(boxY);
    priceText.x = Math.round(boxX + (boxW - priceText.width) / 2);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + (boxW - timerText.width) / 2);
    timerText.y = Math.round(priceText.y + priceText.height + padY);
  };

  function render(layout) {
    const { candles, width, timeframe } = layout;
    if (!candles?.length) { line.clear(); boxBg.clear(); return; }

    const last = candles.at(-1);
    const price = last.price ?? last.close;
    const baseTime = last.openTime ?? last.time ?? last.t ?? null;
    const tfSec = Number.isFinite(timeframe) ? timeframe : 60;
    const computedClose = Number.isFinite(baseTime) ? (baseTime + tfSec) : null;
    lastCloseTime = Number.isFinite(last.closeTime) ? last.closeTime : computedClose;
    currentPrice = price;

    const color = getCandleColor(last, price);
    line._lineColor = color;
    const y = calcY(candles, price, layout);
    drawDotted(line, 0, y, width);

    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + (offsetSet ? serverOffset : 0);
      timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    } else timerText.text = '00:00';

    drawBox(y, price, color, width);
  }

  function updatePrice(price, closeTime, serverTime) {
    currentPrice = price;
    if (Number.isFinite(closeTime)) lastCloseTime = closeTime;
    if (typeof serverTime === 'number' && !offsetSet) {
      serverOffset = serverTime - Math.floor(Date.now() / 1000);
      offsetSet = true;
    }

    const candles = chartCore?.state?.candles;
    const layout  = chartCore?.layout;
    if (!candles?.length || !layout) return;

    const last = candles.at(-1);
    if (!last) return;

    // Обновляем OHLC последней свечи
    last.close = currentPrice;
    if (currentPrice > last.high) last.high = currentPrice;
    if (currentPrice < last.low)  last.low  = currentPrice;

    chartCore.updateLast?.(last);

    // Сообщаем ядру live‑цену и перерисовываем лёгким рендером
    if (chartCore.state) chartCore.state._liveOverride = { price: currentPrice };
    chartCore.invalidateLight?.();

    // Пересчёт и отрисовка
    const color = getCandleColor(last, currentPrice);
    line._lineColor = color;
    const y = calcY(candles, currentPrice, layout);
    drawDotted(line, 0, y, layout.width);

    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + serverOffset;
      timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    } else timerText.text = '00:00';

    drawBox(y, currentPrice, color, layout.width);
  }

  function tick() {
    if (!Number.isFinite(lastCloseTime)) return;
    const now = Math.floor(Date.now() / 1000) + serverOffset;
    timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
  }

  return { render, updatePrice, tick, symbol };
}

// Вебсокет‑обвязка
function connectLiveSocket(chartCore, chartSettings, live) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);
  chartCore._livePriceSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);
      if (typeof data.price === 'number' && typeof data.closeTime === 'number') {
        live.updatePrice(data.price, data.closeTime, data.serverTime);
      }
    } catch (err) {
      console.warn('[LiveSocket] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[LiveSocket] Disconnected');
    if (chartCore._alive) setTimeout(() => connectLiveSocket(chartCore, chartSettings, live), 1000);
  };
}

export function initLive(chartCore, chartSettings) {
  const config = chartCore.config;
  if (!chartSettings?.symbol) {
    console.warn('[initLive] chartSettings missing or invalid:', chartSettings);
    return;
  }

  const live = LivePrice({ group: chartCore.group, config, chartSettings, chartCore });
  chartCore.state.livePrice = live;

  if (chartCore.layout) live.render(chartCore.layout);

  // Стартовые значения
  if (chartCore.state.candles.length) {
    const last = chartCore.state.candles.at(-1);
    const initialPrice = last.price ?? last.close;
    const initialClose = Number.isFinite(last.closeTime)
      ? last.closeTime
      : ((last.openTime ?? last.time ?? last.t ?? Math.floor(Date.now() / 1000)) + (chartCore.state.timeframe || 60));
    live.updatePrice(initialPrice, initialClose, Math.floor(Date.now() / 1000));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);
  chartCore.app.ticker.add(live.tick);
  return live;
}