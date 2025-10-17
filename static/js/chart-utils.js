// chart-utils.js
export const getAdaptiveStepX = (scaleX, candleWidth, spacing) => {
  const spacingPx = (candleWidth + spacing) * scaleX;
  return spacingPx < 100 ? Math.max(1, Math.ceil(100 / spacingPx)) : 1;
};

export const getAdaptiveStepY = scaleY => Math.max(30, Math.round(50 * scaleY));

export const formatTime = (timestamp, tfMs) => {
  const d = new Date(timestamp);
  if (tfMs >= 86400000) return d.toLocaleDateString();
  if (tfMs >= 3600000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleTimeString();
};

export const formatPrice = p =>
  p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toFixed(4);

//дефолтный текст
export const textDefault = (config, overrides = {}) =>
  new PIXI.TextStyle({
    fontFamily: config.chartFont,
    fontSize: config.chartFontSize,
    fontWeight: config.chartFontWeight,
    resolution: window.devicePixelRatio,
    letterSpacing: config.letterSpacing,
    ...overrides
  });

//хелпер синхронизация live
export function syncLive(core) {
  if (core?.config?.modules?.livePrice && core.state?.livePrice) {
    core.state.livePrice.setCandles(core.state.candles);
    core.state.livePrice.setLast(core.state.candles.at(-1));
  }
}
//хелпер свечной, приводит входное значение к числу и проверяет его валидность
export function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : undefined;
}

//счетчик памяти
export function bytesToMB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}
export function MEM() {
  if (performance && performance.memory) {
    return {
      usedJSHeap: bytesToMB(performance.memory.usedJSHeapSize),
      totalJSHeap: bytesToMB(performance.memory.totalJSHeapSize),
      limitJSHeap: bytesToMB(performance.memory.jsHeapSizeLimit)
    };
  }
  return null;
}

//формат $ ohlcv
export function formatMoney(value) {
  if (value === null || value === undefined || isNaN(value)) return "0";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toFixed(2);
}