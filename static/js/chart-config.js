// chart-config.js
export const ChartConfig = {
  //дефолт
  default: {
    chartFont:       "Roboto Condensed",
    chartFontSize:   14,
    chartFontWeight: "normal",
    chartBG:         0x111111,
    letterSpacing:   0
  },

  //параметры
  candles:    { candleBull: 0x00ff00, candleBear: 0xff3b3b, candleWidth: 6, lineColor: 0xffffff },
  livePrice:  { textColor:0xffffff, priceUpColor:0x0C6600, priceDownColor:0xBF1717, tickerBgColor:0x000000 },
  grid:       { gridColor: '0x444444', gridEnabled: true },
  scales:     { scaleTime: true, scalePrice: true, scaleFontSize: 11.5, scaleTickColor: '0xcccccc', scaleBG: '0x222222', minLabelSpacing: 50 },
  //модули
  modules: {
    candles:    true,
    fps:        true,
    ohlcv:      true,
    mouse:      true,
    livePrice:  true,
    indicators: true,
    scales:     false,
    grid:       false,
  },
  //индикаторы
  indicators: [
    'test',
    'volume',
    'ma',
    'sma',
    'rsi'
  ]
};