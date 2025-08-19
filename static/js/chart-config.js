export const ChartConfig = {
  default: {
    chartFont: "Roboto Condensed",
    chartFontSize: 14,
    chartFontWeight: "normal",
    chartBG: '0x111111'
  },
  candles: {
    candleBull: '0xff3b3b',
    candleBear: '0x00ff00'
  },
  grid: {
    gridColor: '#444444',
    gridEnabled: true
  },
  ohlcv: {
    ohlcvOn: true,
    ohlcvLabel: '#777777',
    ohlcvData: '#cccccc'
  },
  indicators: {
    indicatorsEnabled: true
  },
  scales: {
      scaleTime:       true,
      scalePrice:      true,
      scaleFontSize:   11.5,
      scaleTickColor:  '0xcccccc',
      scaleBG:         '0x222222',
      minLabelSpacing: 50
  },
  fps: {
    fpsOn: true,
    fpsColor: '0x00ff00'
  }
};
