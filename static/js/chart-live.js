// chart-live.js
import { createTextStyle, MemoryTracker } from './chart-utils.js';

const toSec = ts => ts == null ? null : (ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts));

export function LivePrice({ group, config, chartSettings, chartCore }) {
  const padX = 8, padY = 4;

  // слои
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

  // состояние
  let layout = null;
  let candles = null;
  let last = null;
  let currentPrice = null;

  let lastCloseTime = null;
  let serverOffset = 0;
  let offsetSet = false;

  // утилиты
  const drawDotted = (g, x1, y, x2, dotR = 0.5, gap = 5) => {
    g.beginFill(g._lineColor || 0xffffff);
    for (let x = x1; x < x2; x += dotR * 2 + gap) g.drawCircle(x, y, dotR);
    g.endFill();
  };

  const formatTime = sec => {
    if (!Number.isFinite(sec)) return '00:00';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const getCandleColor = c => {
    const upColor = +(config.priceUpColor ?? config.livePrice?.priceUpColor ?? 0x0C6600);
    const downColor = +(config.priceDownColor ?? config.livePrice?.priceDownColor ?? 0xBF1717);
    if (!c) return upColor;
    return (c.close >= c.open) ? upColor : downColor;
  };

  const calcYLocal = (price) => {
    if (!layout || !candles?.length || !Number.isFinite(price)) return 0;
    if (typeof layout.priceToY === 'function') return layout.priceToY(price);

    // локально считаем по текущему набору свечей
    const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const rawY = layout.plotH * (1 - (price - minP) / range);
    return rawY * layout.scaleY + layout.offsetY;
  };

  const drawBox = (y, price, color) => {
    priceText.text = Number.isFinite(price) ? price.toFixed(2) : '';
    const boxW = 70;
    const boxH = 41;

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

    if (layout) {
      const inViewport = y >= layout.plotY && y <= layout.plotY + layout.plotH;
      overlay.alpha = inViewport ? 1 : 0;
    }
  };

  // единая отрисовка
  const renderLive = () => {
    if (!layout || !candles?.length || !last) return;

    const price = Number.isFinite(currentPrice) ? currentPrice : (last.price ?? last.close);
    const y = calcYLocal(price);
    const color = getCandleColor(last);

    line.clear();
    line._lineColor = color;
    drawDotted(line, 0, y, layout.width);

    if (Number.isFinite(lastCloseTime)) {
      const now = Math.floor(Date.now() / 1000) + (offsetSet ? serverOffset : 0);
      timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    } else {
      timerText.text = '00:00';
    }

    drawBox(y, price, color);
  };

  // публичные методы для ядра
  const setLayout = L => {
    layout = L;
    renderLive();
  };

  const setCandles = arr => {
    candles = arr;
    last = candles?.length ? candles[candles.length - 1] : null;

    // предустановим начальный closeTime, если его нет
    if (last && !Number.isFinite(lastCloseTime)) {
      const baseTime = toSec(last.openTime ?? last.time ?? last.t);
      const tfSec = Number.isFinite(layout?.timeframe) ? layout.timeframe : (chartCore?.state?.timeframe || 60);
      const computedClose = baseTime != null ? (baseTime + tfSec) : null;
      lastCloseTime = Number.isFinite(toSec(last.closeTime)) ? toSec(last.closeTime) : computedClose;
    }
    renderLive();
  };

  const setLast = c => {
    last = c || last;
    renderLive();
  };

  const setPrice = (price, closeTime, serverTime) => {
    currentPrice = price;

    if (Number.isFinite(closeTime)) lastCloseTime = toSec(closeTime);
    if (typeof serverTime === 'number' && !offsetSet) {
      serverOffset = toSec(serverTime) - Math.floor(Date.now() / 1000);
      offsetSet = true;
    }

    // цвет и high/low уже обновляются ядром в updateLastCandle;
    // нам важно только перерисоваться
    renderLive();
  };

  const tick = () => {
    if (!Number.isFinite(lastCloseTime)) return;
    const now = Math.floor(Date.now() / 1000) + serverOffset;
    timerText.text = formatTime(Math.max(lastCloseTime - now, 0));
    renderLive();

    if (performance && performance.memory) {
      console.log(
        'Heap used:',
        (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB'
      );
    }
    MemoryTracker.report();
  };


  return {
    render: setLayout,              // совместимость: render(layout)
    updatePrice: setPrice,          // совместимость: updatePrice(price, closeTime, serverTime)
    tick,
    setLayout,
    setCandles,
    setLast,
    symbol: chartSettings?.symbol ?? '???'
  };
}

// аккуратный сокет с защитой от дублей
export function initLive(chartCore, chartSettings) {
  const config = chartCore.config;
  if (!chartSettings?.symbol) return;

  // закрыть старый сокет
  if (chartCore._livePriceSocket) {
    try {
      chartCore._livePriceSocket.onmessage = null;
      chartCore._livePriceSocket.onclose = null;
      chartCore._livePriceSocket.close();
    } catch {}
    chartCore._livePriceSocket = null;
  }

  const live = LivePrice({ group: chartCore.graphGroup, config, chartSettings, chartCore });
  chartCore.state.livePrice = live;

  // передать живому модулю актуальные данные
  live.setCandles(chartCore.state.candles);
  if (chartCore.state.layout) live.setLayout(chartCore.state.layout);

  // инициализационный тик цены
  const arr = chartCore.state.candles;
  if (arr.length) {
    const last = arr.at(-1);
    const initialPrice = last.price ?? last.close;
    const baseTime = toSec(last.openTime ?? last.time ?? last.t);
    const tfSec = Number.isFinite(chartCore.state.timeframe) ? chartCore.state.timeframe : 60;
    const initialClose = Number.isFinite(toSec(last.closeTime))
      ? toSec(last.closeTime)
      : (baseTime != null ? baseTime + tfSec : null);

    live.updatePrice(initialPrice, initialClose, Math.floor(Date.now() / 1000));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);
  chartCore.app.ticker.add(live.tick);
  return live;
}

function connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live) {
  if (chartCore._livePriceSocket) {
    try {
      chartCore._livePriceSocket.onmessage = null;
      chartCore._livePriceSocket.onclose = null;
      chartCore._livePriceSocket.close();
    } catch {}
  }

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
      setTimeout(() => {
        if (chartCore._alive) connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live);
      }, 1000);
    }
  };
}
