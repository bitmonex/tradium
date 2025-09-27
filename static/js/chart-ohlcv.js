//chart-ohlcv.js
export function OHLCV({ config, chartSettings = {}, group }) {
  const {
    ohlcvOn,
    ohlcvLabel,
    ohlcvData,
    tickerColor,
    chartFont,
    chartFontSize,
    chartFontWeight
  } = config;

  if (!group || !ohlcvOn) {
    const stub = new PIXI.Container();
    return { layer: stub, init: () => {}, render: () => {}, update: () => {} };
  }

  const layer = new PIXI.Container();
  layer.zIndex = 30;
  group.addChild(layer);

  const resolution = window.devicePixelRatio;
  const baseStyle = {
    fontFamily: chartFont,
    fontSize: chartFontSize,
    fontWeight: chartFontWeight,
    resolution
  };

  const tickerStyle = new PIXI.TextStyle({ ...baseStyle, fill: tickerColor });
  const labelStyle  = new PIXI.TextStyle({ ...baseStyle, fill: ohlcvLabel });
  const valueStyle  = new PIXI.TextStyle({ ...baseStyle, fill: ohlcvData });

  let candles = [];
  let lastRenderIdx = -1;
  let lastHoverIdx = -1;

  let tickerText;
  const labelTexts = [];
  const valueTexts = [];

  function init(newCandles, newVolumes) {
    candles = newCandles;
    lastRenderIdx = -1;
    lastHoverIdx = -1;
    tickerText = null;
    layer.removeChildren();
    labelTexts.length = 0;
    valueTexts.length = 0;
  }

  function render(candle) {
    if (!candle) return;

    const idx = candles.findIndex(c => c.time === candle.time);
    if (idx === lastRenderIdx) return;
    lastRenderIdx = idx;

    if (!tickerText) {
      tickerText = new PIXI.Text('', tickerStyle);
      tickerText.x = 15;
      tickerText.y = 12;
      tickerText.interactive = true;
      tickerText.buttonMode = true;
      // хитовая область по размеру текста
      tickerText.hitArea = new PIXI.Rectangle(0, 0, 400, chartFontSize * 2);

      tickerText.on('pointertap', () => {
        alert(tickerText.text);
      });

      layer.addChild(tickerText);

      const items = getOHLCVItems(candle, candles);
      for (const it of items) {
        const lbl = new PIXI.Text(it.label, labelStyle);
        const val = new PIXI.Text('', valueStyle);
        layer.addChild(lbl, val);
        labelTexts.push(lbl);
        valueTexts.push(val);
      }
    }
    _updateAll(candle);
  }

  function update(candle, opts) {
    if (!tickerText || !candle) return;

    const force = opts?.force === true;
    const idx = candles.findIndex(c => c.time === candle.time);
    const isLast = idx === candles.length - 1;

    if (!force && !isLast && (idx < 0 || idx === lastHoverIdx)) return;

    lastHoverIdx = idx;
    _updateAll(candle);
  }

  function _updateAll(candle) {
    const exch  = chartSettings.exchange   || '';
    const mType = chartSettings.marketType || '';
    const symb  = chartSettings.symbol     || '';
    tickerText.text = `${exch.toUpperCase()} - ${mType.toUpperCase()} - ${symb}`;
    let x = tickerText.x + tickerText.width + 20;
    const items = getOHLCVItems(candle, candles);

    for (let i = 0; i < items.length; i++) {
      const lbl = labelTexts[i];
      const val = valueTexts[i];
      const { label, value } = items[i];

      lbl.text = label;
      val.text = value;

      lbl.x = x;
      lbl.y = 12;
      val.x = lbl.x + lbl.width + 2;
      val.y = 12;

      x += lbl.width + val.width + 15;
    }
  }

  return { layer, init, render, update };
}

function getOHLCVItems(candle, candles) {
  const volBtc   = candle.volume || 0;
  const volUsd   = volBtc * candle.close;
  const volLabel = formatMoney(volUsd);

  const idx      = candles.findIndex(c => c.time === candle.time);
  const prevVol  = idx > 0 ? candles[idx - 1].volume : 0;
  const delta    = volBtc - prevVol;
  const pct      = prevVol > 0 ? (delta / prevVol) * 100 : 0;
  const sign     = delta >= 0 ? '+' : '–';
  const change   = `${sign}${formatMoney(Math.abs(delta))} (${pct.toFixed(2)}%)`;

  const ampAbs   = candle.high - candle.low;
  const ampPct   = candle.low !== 0 ? (ampAbs / candle.low) * 100 : 0;
  const amp      = `${ampAbs.toFixed(2)} (${ampPct.toFixed(2)}%)`;

  return [
    { label: 'O',      value: candle.open.toFixed(2) },
    { label: 'H',      value: candle.high.toFixed(2) },
    { label: 'L',      value: candle.low.toFixed(2) },
    { label: 'C',      value: candle.close.toFixed(2) },
    { label: 'V',      value: volLabel },
    { label: 'Change', value: change },
    { label: 'Amp',    value: amp }
  ];
}

function formatMoney(v) {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (abs / 1e9).toFixed(2) + 'b';
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + 'm';
  if (abs >= 1e3) return (abs / 1e3).toFixed(2) + 'k';
  return abs.toFixed(2);
}
