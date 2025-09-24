//chart-candles.js
let lastCandleRef = null, lastTs = null;

export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core?.state?.candles?.length) return;
  const arr = core.state.candles;

  if (!lastCandleRef || lastCandleRef !== arr[arr.length - 1]) {
    lastCandleRef = arr[arr.length - 1];
    lastTs = lastCandleRef.timestamp;
  }

  const intervalMs = core.state.tfMs || 60000;
  let ts = candle.timestamp ?? candle.time;
  if (!ts) return;
  if (ts < 1e12) ts *= 1000;
  ts = Math.floor(ts / intervalMs) * intervalMs;

  if (!lastCandleRef) {
    arr.push({ ...candle, timestamp: ts });
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else if (lastTs === ts) {
    lastCandleRef.open = candle.open;
    lastCandleRef.close = candle.close;
    lastCandleRef.price = candle.price;
    lastCandleRef.volume = candle.volume;
    if (candle.high > lastCandleRef.high) lastCandleRef.high = candle.high;
    if (candle.low < lastCandleRef.low) lastCandleRef.low = candle.low;
  } else if (ts > lastTs) {
    arr.push({ ...candle, timestamp: ts });
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  } else {
    arr[arr.length - 1] = { ...candle, timestamp: ts };
    lastCandleRef = arr[arr.length - 1];
    lastTs = ts;
  }

  core.state._needRedrawCandles = true;
  core.drawCandlesOnly?.();

  // realtime-обновление OHLCV (форс)
  core.state.ohlcv?.update?.(lastCandleRef, { force: true });
}

// 🔥 Основная функция отрисовки
export function attachDrawCandles(core) {
  core.drawCandlesOnly = function() {
    const candles = core.state.candles;
    const style = core.state.chartStyle || "candles";

    const g = new PIXI.Graphics();
    core.layer.removeChildren();
    core.layer.addChild(g);

    const cw = (core.state.config.candleWidth + core.state.config.spacing) * core.state.scaleX;
    const usableW = core.state.usableW ?? core.state.plotW;
    const plotH = core.state.plotH;

    if (style === "line") {
      // 🔹 Линия по close
      g.lineStyle(1, 0xffffff);
      candles.forEach((c, i) => {
        const x = i * cw + core.state.offsetX;
        if (x > usableW) return;
        const y = plotH * (1 - c.close / core.state.maxPrice);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
    } else {
      // 🔹 Свечи (обычные или Heikin Ashi)
      let prevHAopen = candles[0]?.open ?? 0;
      let prevHAclose = candles[0]?.close ?? 0;

      candles.forEach((c, i) => {
        const x = i * cw + core.state.offsetX;
        if (x > usableW) return;

        let open = c.open, close = c.close, high = c.high, low = c.low;

        if (style === "heikin") {
          const haClose = (c.open + c.high + c.low + c.close) / 4;
          const haOpen = (prevHAopen + prevHAclose) / 2;
          const haHigh = Math.max(c.high, haOpen, haClose);
          const haLow = Math.min(c.low, haOpen, haClose);

          open = haOpen;
          close = haClose;
          high = haHigh;
          low = haLow;

          prevHAopen = haOpen;
          prevHAclose = haClose;
        }

        const yOpen = plotH * (1 - open / core.state.maxPrice);
        const yClose = plotH * (1 - close / core.state.maxPrice);
        const yHigh = plotH * (1 - high / core.state.maxPrice);
        const yLow = plotH * (1 - low / core.state.maxPrice);

        const color = close >= open ? 0x00ff00 : 0xff0000;

        // тень
        g.lineStyle(1, color);
        g.moveTo(x + cw / 2, yHigh);
        g.lineTo(x + cw / 2, yLow);

        // тело
        g.beginFill(color);
        g.drawRect(x, Math.min(yOpen, yClose), cw, Math.abs(yClose - yOpen) || 1);
        g.endFill();
      });
    }
  };
}
