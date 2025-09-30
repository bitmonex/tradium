// chart-candles.js
import { syncLive, num } from './chart-utils.js';

let lastCandleRef = null, lastTs = null;

export function resetCandleCursor() {
  lastCandleRef = null;
  lastTs = null;
}

export const candleRenderSettings = {
  barTickRatio: 0.9,
  barTickLen: 6,
  barLineWidth: 1.5,
  lineWidth: 1.5,
  lineColor: 0xffffff
};

const MAX_CANDLES = 5000;

// Обновление последней свечи
export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core) return;
  const arr = core.state.candles;
  const intervalMs = core.state.tfMs || 60000;
  let ts = candle.timestamp ?? candle.time ?? Date.now();
  if (!ts) return;
  if (ts < 1e12) ts *= 1000;

  // для линейного графика
  if (core.state.chartStyle === "line") {
    const c = num(candle.close ?? candle.price ?? candle.c ?? candle.lastPrice);
    if (c === undefined) {
      console.warn("⚠️ LINE: нет валидного close", candle);
      return;
    }
    const last = arr[arr.length - 1];
    if (last && last.timestamp === candle.timestamp) {
      last.open = last.high = last.low = last.close = c;
    } else if (!last || candle.timestamp > last.timestamp) {
      arr.push({ open: c, high: c, low: c, close: c, volume: 0, timestamp: candle.timestamp });
      if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
      syncLive(core);
    } else {
      last.open = last.high = last.low = last.close = c;
    }
    core.state._needRedrawCandles = true;
    return;
  }

  // для баров
  ts = Math.floor(ts / intervalMs) * intervalMs;
  if (core.state.chartStyle === "bars") {
    const obj = {
      open: num(candle.open),
      high: num(candle.high),
      low:  num(candle.low),
      close: num(candle.close ?? candle.price),
      volume: num(candle.volume),
      timestamp: ts
    };
    const last = arr[arr.length - 1];
    if (!last || last.timestamp !== ts) {
      arr.push(obj);
      if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
      lastCandleRef = arr[arr.length - 1];
      lastTs = ts;
      syncLive(core);
    } else {
      last.open   = obj.open   ?? last.open;
      last.close  = obj.close  ?? last.close;
      last.volume = obj.volume ?? last.volume;
      if (isFinite(obj.high) && (last.high == null || obj.high > last.high)) last.high = obj.high;
      if (isFinite(obj.low)  && (last.low  == null || obj.low  < last.low))  last.low  = obj.low;
      lastCandleRef = last;
      lastTs = ts;
    }
    core.state._needRedrawCandles = true;
    return;
  }

  // для свечи и хейкен
  ts = Math.floor(ts / intervalMs) * intervalMs;
  if (!lastCandleRef || lastCandleRef !== arr[arr.length - 1]) {
    lastCandleRef = arr[arr.length - 1];
    lastTs = lastCandleRef?.timestamp;
  }
  if (!lastCandleRef) {
    const obj = {
      open: num(candle.open),
      high: num(candle.high),
      low:  num(candle.low),
      close: num(candle.close ?? candle.price),
      volume: num(candle.volume),
      timestamp: ts
    };
    arr.push(obj);
    if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
    syncLive(core);
  } else if (lastTs === ts) {
    lastCandleRef.open   = num(candle.open)   ?? lastCandleRef.open;
    lastCandleRef.close  = num(candle.close ?? candle.price) ?? lastCandleRef.close;
    lastCandleRef.volume = num(candle.volume) ?? lastCandleRef.volume;
    const h = num(candle.high);
    const l = num(candle.low);
    if (isFinite(h) && (lastCandleRef.high == null || h > lastCandleRef.high)) lastCandleRef.high = h;
    if (isFinite(l) && (lastCandleRef.low == null || l < lastCandleRef.low))  lastCandleRef.low  = l;
  } else if (ts > lastTs) {
    const obj = {
      open: num(candle.open),
      high: num(candle.high),
      low:  num(candle.low),
      close: num(candle.close ?? candle.price),
      volume: num(candle.volume),
      timestamp: ts
    };
    arr.push(obj);
    if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
    syncLive(core);
  } else {
    arr[arr.length - 1] = {
      open: num(candle.open),
      high: num(candle.high),
      low:  num(candle.low),
      close: num(candle.close ?? candle.price),
      volume: num(candle.volume),
      timestamp: ts
    };
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  }
  core.state._needRedrawCandles = true;
}

// свечная модель хейкен
export function toHeikin(candles) {
  const res = [];
  if (!candles.length) return res;
  let prevOpen = candles[0].open;
  let prevClose = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    res.push({ open: haOpen, high: haHigh, low: haLow, close: haClose, timestamp: c.timestamp });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return res;
}

// рендер candles/heikin
export function renderCandles(series, layer, layout, config) {
  layer.removeChildren();
  const cw = (config.candleWidth + config.spacing) * layout.scaleX;

  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    const g = new PIXI.Graphics();
    const x = i * cw + layout.offsetX;
    const color = v.close >= v.open ? +config.candleBull : +config.candleBear;

    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);

    // тень
    g.moveTo(x + (config.candleWidth * layout.scaleX) / 2, yHigh)
     .lineTo(x + (config.candleWidth * layout.scaleX) / 2, yLow)
     .stroke({ width: 1, color });

    // тело
    g.rect(
      x,
      Math.min(yOpen, yClose),
      config.candleWidth * layout.scaleX,
      Math.max(1, Math.abs(yClose - yOpen))
    ).fill(color);

    layer.addChild(g);
  }
}

// рендер line
export function renderLine(series, layer, layout, config, settings) {
  layer.removeChildren();
  const g = new PIXI.Graphics();
  layer.addChild(g);
  const cw = (config.candleWidth + config.spacing) * layout.scaleX;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    const x = i * cw + layout.offsetX;
    const y = layout.priceToY(v.close);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke({ width: settings.lineWidth, color: settings.lineColor, alpha: 1 });
}

// рендер bars
export function renderBars(series, layer, layout, config, settings) {
  layer.removeChildren();
  const gBull = new PIXI.Graphics();
  const gBear = new PIXI.Graphics();
  layer.addChild(gBull, gBear);

  const cw = (config.candleWidth + config.spacing) * layout.scaleX;
  const tickLen = Math.max(
    2,
    Math.min(12, config.candleWidth * layout.scaleX * settings.barTickRatio)
  );

  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    const x = i * cw + layout.offsetX;
    const yOpen  = layout.priceToY(v.open);
    const yClose = layout.priceToY(v.close);
    const yHigh  = layout.priceToY(v.high);
    const yLow   = layout.priceToY(v.low);

    if (v.close >= v.open) {
      // бычьи бары
      gBull.moveTo(x, yHigh).lineTo(x, yLow);
      gBull.moveTo(x - tickLen, yOpen).lineTo(x, yOpen);
      gBull.moveTo(x, yClose).lineTo(x + tickLen, yClose);
    } else {
      // медвежьи бары
      gBear.moveTo(x, yHigh).lineTo(x, yLow);
      gBear.moveTo(x - tickLen, yOpen).lineTo(x, yOpen);
      gBear.moveTo(x, yClose).lineTo(x + tickLen, yClose);
    }
  }

  gBull.stroke({ width: settings.barLineWidth, color: +config.candleBull, alpha: 1 });
  gBear.stroke({ width: settings.barLineWidth, color: +config.candleBear, alpha: 1 });
}