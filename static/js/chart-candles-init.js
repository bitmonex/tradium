// chart-candles-init.js
import { CandlesModule } from './chart-candles.js';

export function initRealtimeCandles(chartCore, chartSettings) {
  chartCore._alive = true;

  // Закрываем предыдущий сокет, если был
  try {
    chartCore._candlesSocket?.close();
  } catch {}

  // Создаём/переиспользуем модуль свечей
  let candles = chartCore.modules?.candles;
  if (!candles) {
    candles = CandlesModule(chartCore);
    chartCore.registerModule('candles', candles);
  }

  connectCandlesSocket(chartCore, chartSettings, candles);
}

function connectCandlesSocket(chartCore, chartSettings, candles) {
  const { exchange, marketType, symbol, timeframe } = chartSettings;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`;

  const ws = new WebSocket(url);
  chartCore._candlesSocket = ws;

  ws.onopen = () => {
    // При новом подключении пересчитаем layout под уже загруженную историю
    chartCore.setFlag('layoutDirty');
    chartCore.setFlag('candlesDirty');
  };

  ws.onmessage = e => {
    if (!chartCore._alive) return;

    try {
      const data = JSON.parse(e.data);

      // Пришёл апдейт свечи
      if (
        typeof data.open === 'number' &&
        typeof data.close === 'number' &&
        typeof data.high === 'number' &&
        typeof data.low === 'number'
      ) {
        // Нормализуем возможные поля времени под updateLastCandle
        if (data.timestamp && data.timestamp < 1e12) data.timestamp *= 1000;
        if (data.openTime && data.openTime < 1e12) data.openTime *= 1000;
        if (data.time && data.time < 1e12) data.time *= 1000;

        candles.updateLastCandle(data);
      }
    } catch (err) {
      // некорректный пакет — пропускаем
    }
  };

  ws.onerror = () => {
    // можно добавить метрики/уведомления
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      // Ре-коннект с небольшой задержкой
      setTimeout(() => connectCandlesSocket(chartCore, chartSettings, candles), 800);
    }
  };
}
