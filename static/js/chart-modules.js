//chart-modules.js
import { initCandles } from './chart-candles.js';
import { FPS } from './chart-fps.js';
import { OHLCV } from './chart-ohlcv.js';
import { Mouse } from './chart-mouse.js';
import { LivePrice } from './chart-live.js';
import { createIndicatorsManager } from './chart-indicators.js';

//пока простые заглушки для grid/scales
function GridModule() { return { enabled: true }; }
function ScalesModule() { return { enabled: true }; }

export function initModules({ app, config, chartSettings, graphGroup, state, modules, chartCore }) {
  //сохраняем конфиг модулей в state
  state.modules = modules;

  //Candles
  if (modules.candles) {
    state.candlesModule = initCandles(chartCore, chartSettings);
  }
  //FPS
  if (modules.fps) {
    state.fps = new FPS(config, { showMemory: true });
  }
  //OHLCV
  if (modules.ohlcv) {
    state.ohlcv = new OHLCV(chartCore, {
      exchange: chartSettings.exchange,
      marketType: chartSettings.marketType,
      symbol: chartSettings.symbol
    });
  }
  //Mouse
  if (modules.mouse) {
    state.mouse = new Mouse(
      app,
      config,
      () => state,
      {
        render: () => chartCore.scheduleRender({ full: true }),
        update: (candle) => state.ohlcv?.updateHover?.(candle),
        chartCore
      }
    );
    state.mouse.init();
  }
  //LivePrice
  if (modules.livePrice) {
    state.livePrice = LivePrice(chartCore, config);
    chartCore.app.ticker.add(() => state.livePrice.render());
  }  
  // Indicators
  if (modules.indicators) {
    chartCore.indicators = createIndicatorsManager(chartCore);
    chartCore.indicators.initFromConfig();
  }
  // --- Grid ---
  if (modules.grid) {
    state.gridModule = GridModule({ config, state, chartCore });
  }
  // --- Scales ---
  if (modules.scales) {
    state.scalesModule = ScalesModule({ config, state, chartCore });
  }
}