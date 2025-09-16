import { createTextStyle } from './chart-utils.js';

export function LivePrice({ group, config, chartSettings, chartCore }) {
  const symbol = chartSettings?.symbol ?? '???';
  const padX = 8;
  const padY = 4;

  // Сносим старый overlay, если был
  if (chartCore?.state?.livePriceOverlay) {
    try { chartCore.state.livePriceOverlay.destroy({ children: true }); } catch {}
  }

  // Слой для пунктирной линии
  const lineLayer = new PIXI.Container();
  lineLayer.sortableChildren = true;
  lineLayer.zIndex = 100;
  group.addChild(lineLayer);

  const line = new PIXI.Graphics();
  lineLayer.addChild(line);

  // Overlay поверх графика
  const overlay = new PIXI.Container();
  overlay.sortableChildren = true;
  overlay.zIndex = 101;
  group.parent.addChild(overlay);

  if (chartCore?.state) {
    chartCore.state.livePriceOverlay = overlay;
  }

  const baseStyle = createTextStyle(config, { fill: +(config.textColor ?? 0xffffff) });

  const boxBg = new PIXI.Graphics();
  const priceText = new PIXI.Text('', baseStyle);
  const timerText = new PIXI.Text('', baseStyle);
  overlay.addChild(boxBg, priceText, timerText);

  let lastCloseTime = null;
  let currentPrice = null;
  let serverOffset = 0;
  let offsetSet = false;

  function drawDotted(g, x1, y, x2, dotR = 1, gap = 4) {
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
    const baseTime = last.openTime ?? last.time ?? last.t ?? null;
    const tfSec = Number.isFinite(timeframe) ? timeframe : 60;
    const computedClose = Number.isFinite(baseTime) ? (baseTime + tfSec) : null;
    lastCloseTime = Number.isFinite(last.closeTime) ? last.closeTime : computedClose;
    currentPrice = price;

    const upColor = +(config.priceUpColor ?? config.livePrice?.priceUpColor ?? 0x2ecc71);
    const downColor = +(config.priceDownColor ?? config.livePrice?.priceDownColor ?? 0xe74c3c);
    const isUp = (last.close ?? price) >= (last.open ?? price);
    const currentColor = isUp ? upColor : downColor;
    line._lineColor = currentColor;

    const allPrices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const plotH = height - (config.bottomOffset ?? 0);
    const rawY = plotH * (1 - (price - minP) / range);
    const y = rawY * scaleY + offsetY;

    drawDotted(line, 0, y, width);

    priceText.text = Number.isFinite(price) ? price.toFixed(2) : '';
    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + (offsetSet ? serverOffset : 0);
      const timer = Math.max(lastCloseTime - now, 0);
      timerText.text = formatTime(timer);
    } else {
      timerText.text = '00:00';
    }

    const textW = Math.max(priceText.width, timerText.width);
    const boxW = Math.max(70, textW + padX * 2);
    const boxH = Math.max(40, priceText.height + timerText.height + padY * 3);

    boxBg.clear();
    boxBg.beginFill(currentColor);
    boxBg.drawRect(0, 0, boxW, boxH);
    boxBg.endFill();

    const boxX = width - boxW;
    const boxY = y - boxH / 2;
    boxBg.x = Math.round(boxX);
    boxBg.y = Math.round(boxY);
    priceText.x = Math.round(boxX + (boxW - priceText.width) / 2);
    priceText.y = Math.round(boxY + padY);
    timerText.x = Math.round(boxX + (boxW - timerText.width) / 2);
    timerText.y = Math.round(priceText.y + priceText.height + padY);
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

    const candles = chartCore?.state?.candles;
    const layout  = chartCore?.layout;
    if (!candles?.length || !layout) return;

    const last = candles.at(-1);
    if (!last) return;

    last.close = currentPrice;
    if (currentPrice > last.high) last.high = currentPrice;
    if (currentPrice < last.low)  last.low  = currentPrice;

    if (typeof chartCore.updateLast === 'function') {
      chartCore.updateLast(last);
    }
    if (typeof chartCore.drawCandlesOnly === 'function') {
      chartCore.drawCandlesOnly();
    }

    // Перерисовываем линию и плашку синхронно со свечой
    render(layout);
  }

  function tick() {
    // только таймер, без движения линии
    if (!Number.isFinite(lastCloseTime)) return;
    const now = Math.floor(Date.now() / 1000) + serverOffset;
    const timer = Math.max(lastCloseTime - now, 0);
    timerText.text = formatTime(timer);
  }

  return { render, updatePrice, tick, symbol };
}

function connectLiveSocket(chartCore, chartSettings, live) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
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
    const initialPrice = last.price ?? last.close;
    const initialClose = Number.isFinite(last.closeTime)
      ? last.closeTime
      : ((last.openTime ?? last.time ?? last.t ?? Math.floor(Date.now() / 1000)) +
         (chartCore.state.timeframe || 60));

    // сразу обновляем свечу, линию и плашку
    live.updatePrice(initialPrice, initialClose, Math.floor(Date.now() / 1000));
    // и один раз обновляем таймер
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);

  // вешаем tick как ссылку, чтобы можно было снять в destroy()
  chartCore.app.ticker.add(live.tick);

  return live;
}

