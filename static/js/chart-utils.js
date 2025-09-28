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

//Дефолтный текст
export const createTextStyle = (config, overrides = {}) =>
  new PIXI.TextStyle({
    fontFamily: config.chartFont,
    fontSize: config.chartFontSize,
    fontWeight: config.chartFontWeight,
    resolution: window.devicePixelRatio,
    letterSpacing: config.letterSpacing,
    ...overrides
  });

//Трекер памяти по модулям
export const MemoryTracker = {
  modules: {},
  add(module, bytes) {
    this.modules[module] = (this.modules[module] || 0) + bytes;
  },
  sub(module, bytes) {
    this.modules[module] = Math.max(0, (this.modules[module] || 0) - bytes);
  },
  report() {
    const total = Object.values(this.modules).reduce((a, b) => a + b, 0);
    console.log('Total Used:', (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
  }
};


//Трекер памяти
export const MemoryProfiler = {
  intervalId: null,
  start(period = 5000) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (performance && performance.memory) {
        console.log(
          'Total Used:',
          (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          'MB'
        );
      }
    }, period);
  },
  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }
};

//Helper
export function syncLive(core) {
  if (core?.config?.modules?.livePrice && core.state?.livePrice) {
    core.state.livePrice.setCandles(core.state.candles);
    core.state.livePrice.setLast(core.state.candles.at(-1));
  }
}
