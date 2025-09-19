// chart-live-init.js
import { LiveModule } from './chart-live.js';

// helper: безопасная нормализация времени в секунды
function toSec(ts) {
  if (ts == null) return null;
  return ts >= 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
}

export function initLive(chartCore, chartSettings) {
  chartCore._alive = true;
  const live = LiveModule(chartCore);
  chartCore.registerModule('live', live);

  const candles = chartCore.state.candles;

  if (candles.length) {
    const last = candles.at(-1);

    // timeframe в секундах (если бывает строка — конвертируй заранее)
    const tfSec = Number(chartCore.state.timeframe) || 60;

    // Опорное время последней свечи истории (в мс) -> сек
    const baseMs = last.time ?? last.openTime ?? last.timestamp ?? Date.now();
    const baseSec = toSec(baseMs);

    // Начало текущего бара (сек) — кратное таймфрейму
    const barStartSec = Math.floor(baseSec / tfSec) * tfSec;

    // Время закрытия бара (сек)
    const initialCloseSec = barStartSec + tfSec;

    const initialPrice = last.price ?? last.close;

    // Текущее серверное время (сек)
    const serverTimeSec = toSec(Date.now());

    live.updatePrice(initialPrice, initialCloseSec, serverTimeSec);
    live.tick();
  }

  connectLiveSocket(chartCore, chartSettings, live);
  chartCore.app.ticker.add(live.tick);
}

function connectLiveSocket(chartCore, chartSettings, live) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;
  const ws = new WebSocket(url);
  chartCore._livePriceSocket = ws;

  ws.onopen = () => {};

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);

      // Нормализуем closeTime/serverTime к секундам перед updatePrice
      if (
        typeof data.price === 'number' &&
        (typeof data.closeTime === 'number' || typeof data.timer === 'number')
      ) {
        const closeTimeSec = toSec(data.closeTime);
        const serverTimeSec = toSec(data.serverTime ?? Date.now());
        if (Number.isFinite(closeTimeSec)) {
          live.updatePrice(data.price, closeTimeSec, serverTimeSec);
        }
      }

      // Опционально: отдельные сообщения таймера
      if (typeof data.timer === 'number' && typeof live.updateTimer === 'function') {
        live.updateTimer(data.timer);
      }
    } catch {
      // пропустим некорректные пакеты
    }
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(() => connectLiveSocket(chartCore, chartSettings, live), 1000);
    }
  };
}
