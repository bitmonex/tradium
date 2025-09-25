// chart-candles-init.js
import { updateLastCandle, attachDrawCandles } from "./chart-candles.js";

export function initRealtimeCandles(chartCore, chartSettings) {
  chartCore._alive = true;

  // читаем стиль из localStorage или дефолт
  //chartCore.state.chartStyle = localStorage.getItem("chartStyle") || "candles";
  chartCore.state.chartStyle = "line"; 
  // подключаем функцию отрисовки
  attachDrawCandles(chartCore);

  try { chartCore._candleSocket?.close(); } catch {}
  connectCandlesSocket(chartCore, chartSettings);
}

function connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(
    `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`
  );
  chartCore._candleSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);
      const intervalMs = chartCore.state.tfMs || 60000;
      let ts = data.timestamp ?? data.time ?? data.openTime;
      if (!ts) return;
      if (ts < 1e12) ts *= 1000;
      ts = Math.floor(ts / intervalMs) * intervalMs;

      const last = chartCore.state.candles.at(-1);
      if ((last && last.timestamp === ts) || !data.isFinal) {
        chartCore.state._needRedrawCandles = true;
        updateLastCandle(data);
        onUpdate?.(false);
      } else {
        chartCore.state.candles.push({ ...data, timestamp: ts });
        chartCore.renderAll();
        onUpdate?.(true);
      }
    } catch {}
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(() => connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }), 800);
    }
  };
}
