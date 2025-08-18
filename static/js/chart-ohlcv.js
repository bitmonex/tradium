// chart-ohlcv.js

import { ChartConfig } from './chart-config.js'

export function OHLCV(config, candles) {
  const { group, chartSettings } = config
  if (!group || !ChartConfig.ohlcv.ohlcvOn) {
    // возвращаем заглушку
    return { layer: new PIXI.Container(), render: () => {}, update: () => {} }
  }

  const layer = new PIXI.Container()
  layer.zIndex = 10
  group.addChild(layer)

  // базовый стиль текста
  const baseStyle = {
    fontFamily: ChartConfig.default.chartFont,
    fontSize:   ChartConfig.default.chartFontSize,
    fontWeight: ChartConfig.default.chartFontWeight
  }

  // стили для лейблов и значений
  const labelStyle = new PIXI.TextStyle({
    fontFamily: baseStyle.fontFamily,
    fontSize:   baseStyle.fontSize,
    fontWeight: baseStyle.fontWeight,
    fill:       ChartConfig.ohlcv.ohlcvLabel
  })

  const valueStyle = new PIXI.TextStyle({
    fontFamily: baseStyle.fontFamily,
    fontSize:   baseStyle.fontSize,
    fontWeight: baseStyle.fontWeight,
    fill:       ChartConfig.ohlcv.ohlcvData
  })

  // храним индекс последней зарендренной свечи
  let lastRenderIdx = -1
  // и индекс последней обновлённой (hover) свечи
  let lastHoverIdx  = -1

  // помогает найти индекс свечи в массиве по совпадающему полю time
  function candleIndex(candle) {
    return candles.findIndex(c => c.time === candle.time)
  }

  function render(candle) {
    if (!candle) return

    const idx = candleIndex(candle)
    if (idx === lastRenderIdx) return
    lastRenderIdx = idx

    layer.removeChildren()
    valueTexts.length = 0

    const items = getOHLCVItems(candle, candles, chartSettings)
    let x = 15

    for (const item of items) {
      if (item.custom) {
        const txt = new PIXI.Text(item.label, {
          ...baseStyle,
          fill: 0xffcc00
        })
        txt.x = x; txt.y = 12
        layer.addChild(txt)
        x += txt.width + 15
      } else {
        const lbl = new PIXI.Text(item.label, labelStyle)
        lbl.x = x; lbl.y = 12
        layer.addChild(lbl)
        x += lbl.width + 2

        const val = new PIXI.Text(item.value, valueStyle)
        val.x = x; val.y = 12
        layer.addChild(val)
        valueTexts.push({ key: item.label, text: val })
        x += val.width + 15
      }
    }
  }

  function update(candle) {
    if (!candle) return

    const idx = candleIndex(candle)
    if (idx === lastHoverIdx) return
    lastHoverIdx = idx

    const items = getOHLCVItems(candle, candles, chartSettings)
    for (const item of items) {
      const found = valueTexts.find(v => v.key === item.label)
      if (found && found.text.text !== item.value) {
        found.text.text = item.value
      }
    }
  }

  const valueTexts = []

  return { layer, render, update }
}


// ————————————————
// вспомогательные функции
// ————————————————

function getOHLCVItems(candle, candles, settings = {}) {
  const volBtc = candle.volume || 0
  const volUsd = volBtc * candle.close
  const volLabel = formatMoney(volUsd)

  const prevVol = candles[candles.indexOf(candle) - 1]?.volume || 0
  const delta   = volBtc - prevVol
  const pct     = prevVol > 0 ? (delta / prevVol) * 100 : 0
  const changeLabel = `${delta >= 0 ? '+' : '–'}${formatMoney(Math.abs(delta))} (${pct.toFixed(2)}%)`

  const ampAbs  = candle.high - candle.low
  const ampPct  = candle.low !== 0 ? (ampAbs / Math.abs(candle.low)) * 100 : 0
  const ampLabel = `${ampAbs.toFixed(2)} (${ampPct.toFixed(2)}%)`

  const { exchange, marketType, symbol } = settings
  const ticker = `${exchange} - ${marketType} - ${symbol}`.toUpperCase()

  return [
    { label: ticker,  value: '',     custom: true },
    { label: 'O',     value: candle.open.toFixed(2) },
    { label: 'H',     value: candle.high.toFixed(2) },
    { label: 'L',     value: candle.low.toFixed(2) },
    { label: 'C',     value: candle.close.toFixed(2) },
    { label: 'V',     value: volLabel },
    { label: 'Change',value: changeLabel },
    { label: 'Amp',   value: ampLabel }
  ]
}

function formatMoney(v) {
  if (!isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return (abs / 1e9).toFixed(2) + 'b'
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + 'm'
  if (abs >= 1e3) return (abs / 1e3).toFixed(2) + 'k'
  return abs.toFixed(2)
}
