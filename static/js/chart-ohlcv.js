import { ChartConfig } from './chart-config.js';

export function OHLCV(config, candles) {
    const { group, chartSettings } = config;
    if (!group) return;

    const layer = new PIXI.Container();
    layer.zIndex = 10;
    group.addChild(layer);

    const labelStyle = new PIXI.TextStyle({
      ...PIXI.Text.defaultStyle,
      fill: ChartConfig.ohlcv.ohlcvLabel
    });

    const valueStyle = new PIXI.TextStyle({
      ...PIXI.Text.defaultStyle,
      fill: ChartConfig.ohlcv.ohlcvData
    });

    let lastCandle = null;
    const valueTexts = [];

    function render(candle) {
        if (!candle || candle === lastCandle) return;
        lastCandle = candle;

        const items = getOHLCVItems(candle, candles, chartSettings);
        layer.removeChildren();
        valueTexts.length = 0;

        let x = 15;
        for (const item of items) {
            if (item.custom) {
                const customText = new PIXI.Text(item.label, {
                    ...PIXI.Text.defaultStyle,
                    fill: 0xffcc00
                });

                customText.x = x;
                customText.y = 12;
                layer.addChild(customText);
                x += customText.width + 15;
                continue;
            }

            const labelText = new PIXI.Text(item.label, labelStyle);
            labelText.x = x;
            labelText.y = 12;
            layer.addChild(labelText);
            x += labelText.width + 2;

            const valueText = new PIXI.Text(item.value, valueStyle);
            valueText.x = x;
            valueText.y = 12;
            layer.addChild(valueText);
            valueTexts.push({ text: valueText, key: item.label });
            x += valueText.width + 15;
        }
    }

    function update(candle) {
        if (!candle || candle === lastCandle) return;
        lastCandle = candle;

        const items = getOHLCVItems(candle, candles, chartSettings);
        for (const item of items) {
            const target = valueTexts.find(v => v.key === item.label);
            if (target && target.text.text !== item.value) {
                target.text.text = item.value;
            }
        }
    }

    return { layer, render, update };
}

function getOHLCVItems(candle, candles, settings = {}) {
    const volBtc = candle.volume || 0;
    const volUsd = volBtc * candle.close;
    const volLabel = formatMoney(volUsd);
    const current = volBtc;
    const prev = candles[candles.indexOf(candle) - 1]?.volume || 0;
    const delta = current - prev;
    const percent = prev > 0 ? ((delta / prev) * 100) : 0;
    const changeLabel = `${delta >= 0 ? '+' : '–'}${formatMoney(Math.abs(delta))} (${percent.toFixed(2)}%)`;
    const amplitudeAbs = candle.high - candle.low;
    const amplitudePercent = candle.low !== 0
        ? (amplitudeAbs / Math.abs(candle.low)) * 100
        : 0;
    const ampLabel = `${amplitudeAbs.toFixed(2)} (${amplitudePercent.toFixed(2)}%)`;
    const { exchange, marketType, symbol } = settings;
    const tickerLabel = `${exchange} - ${marketType} - ${symbol}`.toUpperCase();

    return [
        { label: tickerLabel, value: '', custom: true },
        { label: 'O', value: candle.open.toFixed(2) },
        { label: 'H', value: candle.high.toFixed(2) },
        { label: 'L', value: candle.low.toFixed(2) },
        { label: 'C', value: candle.close.toFixed(2) },
        { label: 'V', value: volLabel },
        { label: 'Change', value: changeLabel },
        { label: 'Amp', value: ampLabel }
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