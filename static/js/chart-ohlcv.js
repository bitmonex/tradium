// chart-ohlcv.js
import { formatMoney } from './chart-utils.js';

export function getOHLCVItems(candle, candles) {
  if (!candle) return [];
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

export class OHLCV {
  constructor(chartCore, options = {}) {
    this.chartCore = chartCore;
    this.dom = document.querySelector(".m-ohlcv");
    if (!this.dom) {
      console.warn("⚠️ Модуль .m-ohlcv не найден в шаблоне");
      return;
    }
    this.exchange   = options.exchange;
    this.marketType = options.marketType;
    this.symbol     = options.symbol;
    this.interval = options.interval ?? 500; // частота автообновления
    this._alive = true;
    this.update = this.update.bind(this);
    this.timer = setInterval(this.update, this.interval);
  }

  // автообновление последней свечи
  update() {
    if (!this._alive) return;
    const candles = this.chartCore?.state?.candles;
    if (!candles?.length) return;
    const last = candles[candles.length - 1];
    this.renderItems(last, candles);
  }

  // обновление при наведении на конкретную свечу
  updateHover(candle) {
    if (!candle) return;
    const candles = this.chartCore?.state?.candles;
    this.renderItems(candle, candles);
  }

  // общий метод отрисовки
  renderItems(candle, candles) {
    const items = getOHLCVItems(candle, candles);
    const header = `<strong class="id">${this.exchange} - ${this.marketType} - ${this.symbol}</strong>`;
    const body = items
      .map(it => `<i class="ohlcv ${it.label.toLowerCase()}"><b>${it.label}:</b>${it.value}</i>`)
      .join(" ");
    this.dom.innerHTML = header + " " + body;

    const tickerEl = this.dom.querySelector(".id");
    if (tickerEl) {
      tickerEl.onclick = () => {
        alert(`${this.exchange} - ${this.marketType} - ${this.symbol}`);
      };
    }
  }

  destroy() {
    this._alive = false;
    clearInterval(this.timer);
    if (this.dom) this.dom.innerHTML = "";
  }
}
