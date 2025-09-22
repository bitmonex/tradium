// chart-config.js
export const ChartConfig = {
  //дефолт
  default: {
    chartFont:       "Roboto Condensed",
    chartFontSize:   14,
    chartFontWeight: "normal",
    chartBG:         '0x111111',
    letterSpacing:   0
  },

  //параметры
  candles:    { candleBull: '0x00ff00', candleBear: '0xff3b3b' },
  grid:       { gridColor: '#444444', gridEnabled: true },
  ohlcv:      { ohlcvOn: true, ohlcvLabel: '#777777', ohlcvData: '#cccccc', tickerColor: '#ffcc00' },
  scales:     { scaleTime: true, scalePrice: true, scaleFontSize: 11.5, scaleTickColor: '0xcccccc', scaleBG: '0x222222', minLabelSpacing: 50 },
  fps:        { fpsOn: true, fpsColor: '0x00ff00' },
  indicators: { indicatorsEnabled: true },
  livePrice: {
      textColor:     0xffffff,
      priceUpColor:  0x0C6600,
      priceDownColor:0xBF1717,
      tickerBgColor: 0x000000
  },
  //модули
  modules: {
    candles:    true,
    grid:       false,
    ohlcv:      true,
    indicators: true,
    scales:     false,
    fps:        true,
    livePrice:  true
  },
  //индикаторы
  indicators: ['test','test2']
};
