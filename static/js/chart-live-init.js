// chart-live-init.js
import { LiveModule } from './chart-live.js';
const toSec = ts => ts == null ? null : (ts >= 1e12 ? Math.floor(ts / 1000) : Math.floor(ts));

export function initLive(chartCore, chartSettings) {
  chartCore._alive = true;
  const live = LiveModule(chartCore);
  chartCore.registerModule('live', live);

  const arr = chartCore.state.candles;
  if (arr.length) {
    const last = arr.at(-1);
    const tfSec = Number(chartCore.state.timeframe) || 60;
    const baseSec = toSec(last.time ?? last.openTime ?? last.timestamp ?? Date.now());
    const closeSec = Math.floor(baseSec / tfSec) * tfSec + tfSec;
    live.updatePrice(last.price ?? last.close, closeSec, toSec(Date.now()));
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);
  chartCore.app.ticker.add(live.tick);
}

function connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`);
  chartCore._livePriceSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const d = JSON.parse(e.data);
      if (typeof d.price === 'number' && (typeof d.closeTime === 'number' || typeof d.timer === 'number')) {
        chartCore.state._needRedrawLive = true;
        live.updatePrice(d.price, toSec(d.closeTime), toSec(d.serverTime ?? Date.now()));
      }
      if (typeof d.timer === 'number' && typeof live.updateTimer === 'function') live.updateTimer(d.timer);
    } catch {}
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(() => connectLiveSocket(chartCore, { exchange, marketType, symbol, timeframe }, live), 1000);
    }
  };
}

