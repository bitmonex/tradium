export function LivePrice(chartCore, config) {
  // удаляем старые плашки, если есть
  chartCore.app.view.parentNode.querySelectorAll('.m-live').forEach(el => el.remove());

  // создаём DOM‑элемент
  const root = document.createElement("div");
  root.className = "m-live";
  const span = document.createElement("span");
  const b = document.createElement("b");
  const i = document.createElement("i");
  const u = document.createElement("u");
  span.appendChild(b);
  span.appendChild(i);
  root.appendChild(span);
  root.appendChild(u);

  // вставляем в контейнер графика
  chartCore.app.view.parentNode.appendChild(root);

  let lastCloseTime = null;
  let serverOffset = 0;
  let currentPrice = null;

  function getCandleColor(candle) {
    const upColor = +(config.livePrice?.priceUpColor ?? 0x577D0A);
    const downColor = +(config.livePrice?.priceDownColor ?? 0xC41638);
    if (!candle) return upColor;
    return (candle.close >= candle.open) ? upColor : downColor;
  }

  function updatePrice(price, closeTime, serverTime) {
    currentPrice = price;
    if (typeof closeTime === "number") lastCloseTime = toSec(closeTime);
    if (typeof serverTime === "number") {
      serverOffset = toSec(serverTime) - Math.floor(Date.now() / 1000);
    }
    render();
  }

  function render() {
    const layout = chartCore.state.layout;
    const candles = chartCore.state.candles;
    if (!layout || !candles?.length || !currentPrice) return;

    const y = layout.priceToY(currentPrice);

    // позиция
    span.style.top = `${y}px`;
    u.style.top = `${y}px`;

    // текст
    b.textContent = `$${currentPrice.toFixed(2)}`;
    if (lastCloseTime) {
      const nowSec = Math.floor(Date.now() / 1000) + serverOffset;
      const remain = Math.max(lastCloseTime - nowSec, 0);
      i.textContent = formatTime(remain);
    }

    // цвет по последней свече
    const last = candles.at(-1);
    if (last) {
      const color = getCandleColor(last);
      const hex = `#${color.toString(16).padStart(6, "0")}`;

      span.style.backgroundColor = hex;
      u.style.borderTop = `1px dashed ${hex}`;

      const textHex = `#${(config.livePrice?.textColor ?? 0xffffff).toString(16).padStart(6, "0")}`;
      b.style.color = textHex;
      i.style.color = textHex;
    }

    // видимость
    const inViewport = y >= layout.plotY && y <= layout.plotY + layout.plotH;
    root.style.display = inViewport ? 'block' : 'none';
  }

  function tick() {
    if (!lastCloseTime) return;
    const nowSec = Math.floor(Date.now() / 1000) + serverOffset;
    const remain = Math.max(lastCloseTime - nowSec, 0);
    i.textContent = formatTime(remain);
  }

  function formatTime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return { updatePrice, render, tick };
}

// общий хелпер
function toSec(ts) {
  if (ts == null) return null;
  return ts >= 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
}
