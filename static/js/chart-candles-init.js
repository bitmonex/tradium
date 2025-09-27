// chart-candles-init.js
import { updateLastCandle, candleRenderSettings } from "./chart-candles.js";

export function initRealtimeCandles(chartCore, chartSettings) {
  chartCore._alive = true;
  chartCore.state.candleRenderSettings = candleRenderSettings;
  // candles heikin bars line
  //chartCore.setChartStyle("candles");
  const savedStyle = localStorage.getItem("chartStyle") || chartCore.state.chartStyle || "candles";
  chartCore.setChartStyle(savedStyle);
  try { chartCore._candleSocket?.close(); } catch {}
  connectCandlesSocket(chartCore, chartSettings);
}

function connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(
    `${proto}://${location.host}/ws/kline?exchange=${exchange}&market_type=${marketType}&symbol=${symbol}&tf=${timeframe}`
  );
  chartCore._candleSocket = ws;

  ws.onmessage = e => {
    if (!chartCore._alive) return;
    try {
      const data = JSON.parse(e.data);
      const style = chartCore.state.chartStyle || "candles";
      const intervalMs = chartCore.state.tfMs || 60000;

      let ts = data.timestamp ?? data.time ?? data.openTime;
      if (!ts) return;
      if (ts < 1e12) ts *= 1000;

      // для line берём «живой» ts (округляем до секунды), для остальных — по интервалу
      let tsFinal;
      if (style === "line") {
        tsFinal = Math.floor(ts / 1000) * 1000;
      } else {
        tsFinal = Math.floor(ts / intervalMs) * intervalMs;
      }

      const norm = {
        open:   num(data.open   ?? data.price ?? data.c ?? data.close),
        high:   num(data.high   ?? data.price ?? data.c ?? data.close),
        low:    num(data.low    ?? data.price ?? data.c ?? data.close),
        close:  num(data.close  ?? data.price ?? data.c ?? data.lastPrice),
        volume: num(data.volume),
        timestamp: tsFinal
      };

      const last = chartCore.state.candles.at(-1);
      const isSameBar = !!(last && last.timestamp === tsFinal);

      updateLastCandle(norm);
      chartCore.drawCandlesOnly?.();

      onUpdate?.(!isSameBar);
    } catch (err) {
      console.warn("[kline] parse error:", err);
    }
  };

  ws.onclose = () => {
    if (chartCore._alive && ws.readyState !== WebSocket.OPEN) {
      setTimeout(
        () => connectCandlesSocket(chartCore, { exchange, marketType, symbol, timeframe, onUpdate }),
        800
      );
    }
  };
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : undefined;
}
