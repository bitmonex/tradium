//chart-live.js
import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings, chartCore }) {
  const padX = 8, padY = 4;

  // Удаляем старые слои, если есть
  chartCore?.state?.livePriceOverlay?.destroy?.({ children: true });
  chartCore?.state?.livePriceLayer?.destroy?.({ children: true });

  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);
  chartCore.state.livePriceLayer = lineLayer;

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);
  chartCore.state.livePriceOverlay = overlay;

  const baseStyle = createTextStyle(config, { fill: +(config.textColor ?? 0xffffff) });
  const boxBg = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  let lastCloseTime = null, currentPrice = null, serverOffset = 0, offsetSet = false;

  const drawDotted = (g, x1, y, x2, dotR = 0.5, gap = 5) => {
    g.beginFill(g._lineColor || 0xffffff);
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
    const upColor = +(config.priceUpColor ?? config.livePrice?.priceUpColor ?? 0x0C6600);
    const downColor = +(config.priceDownColor ?? config.livePrice?.priceDownColor ?? 0xBF1717);
    return (last.close ?? price) >= (last.open ?? price) ? upColor : downColor;
  };

  const calcY = (candles, price, layout) => {
    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices), maxP = Math.max(...allPrices), range = maxP - minP || 1;
    const rawY = layout.plotH * (1 - (price - minP) / range);
    return rawY * layout.scaleY + layout.offsetY;
  };

  const drawBox = (y, price, color, layout) => {
    priceText.text = Number.isFinite(price) ? price.toFixed(2) : '';
    const textW = Math.max(priceText.width, timerText.width);
    const boxW = Math.max(70);
    const boxH = Math.max(41);

    boxBg.clear().beginFill(color).drawRect(0, 0, boxW, boxH).endFill();

    const screenW = chartCore?.app?.renderer?.screen?.width ?? overlay.parent?.width ?? overlay.width ?? 0;
    const boxX = Math.max(0, screenW - boxW);

    const screenH = chartCore?.app?.renderer?.screen?.height ?? overlay.parent?.height ?? overlay.height ?? 0;
    const halfH = boxH / 2;
    const clampedY = Math.min(Math.max(y, halfH), Math.max(halfH, screenH - halfH));
    const boxY = clampedY - halfH;

    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);
    priceText.x = Math.round(boxX + (boxW - priceText.width) / 2);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + (boxW - timerText.width) / 2);
    timerText.y = Math.round(priceText.y + priceText.height + 2);

    const inViewport = y >= layout.plotY && y <= layout.plotY + layout.plotH;
    overlay.alpha = inViewport ? 1 : 0;
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
    const y = calcY(candles, price, layout);

    line.clear();
    line._lineColor = color;
    drawDotted(line, 0, y, width);

    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + (offsetSet ? serverOffset : 0);
      timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    } else timerText.text = '00:00';

    drawBox(y, price, color, layout);
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

    last.close = currentPrice;
    if (currentPrice > last.high) last.high = currentPrice;
    if (currentPrice < last.low)  last.low  = currentPrice;

    chartCore.updateLast?.(last);
    chartCore.state.ohlcv?.update?.(last, { force: true });
    chartCore.state._liveOverride = { price: currentPrice };
    chartCore.invalidateLight?.();

    const color = getCandleColor(last, currentPrice);
    const y = calcY(candles, currentPrice, layout);

    line.clear();
    line._lineColor = color;
    drawDotted(line, 0, y, layout.width);

    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + serverOffset;
      timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    } else timerText.text = '00:00';

    drawBox(y, currentPrice, color, layout);
  }

  function tick() {
    if (!Number.isFinite(lastCloseTime)) return;
    const now = Math.floor(Date.now() / 1000) + serverOffset;
    timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
  }

  return { render, updatePrice, tick, symbol: chartSettings?.symbol ?? '???' };
}

function connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(
    `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`
  );
  chartCore._livePriceSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const d = JSON.parse(e.data);
      if (typeof d.price === 'number' && typeof d.closeTime === 'number') {
        chartCore.state._needRedrawLive = true;
        live.updatePrice(d.price, d.closeTime, d.serverTime);
      }
    } catch {}
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(() => connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live), 1000);
    }
  };
}

export function initLive(chartCore, chartSettings) {
  const config = chartCore.config;
  if (!chartSettings?.symbol) return;

  const live = LivePrice({ group: chartCore.graphGroup, config, chartSettings, chartCore });
  chartCore.state.livePrice = live;

  const arr = chartCore.state.candles;
  if (arr.length) {
    const last = arr.at(-1);
    const initialPrice = last.price ?? last.close;
    const initialClose = Number.isFinite(last.closeTime)
      ? last.closeTime
      : ((last.openTime ?? last.time ?? last.t ?? Math.floor(Date.now() / 1000)) +
         (chartCore.state.timeframe || 60));
    live.updatePrice(initialPrice, initialClose, Math.floor(Date.now() / 1000));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);
  chartCore.app.ticker.add(live.tick);
  return live;
}