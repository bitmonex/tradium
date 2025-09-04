//chart-candles.js

//Обновляет последнюю свечу в массиве state.candles и перерисовывает лишь слой свечей, если доступен drawCandlesOnly
export function updateLastCandle(candle) {
  const core = window.chartCore;
  if (!core || !core.state?.candles) return;

  const arr = core.state.candles;
  if (candle.isFinal) {
    // финализируем: убираем старую и добавляем новую
    arr.shift();
    arr.push(candle);
  } else {
    // обновляем незакрытую
    arr[arr.length - 1] = candle;
  }

  // если можно — рисуем только свечи
  if (typeof core.drawCandlesOnly === 'function') {
    core.drawCandlesOnly();
  } else {
    // иначе — полный redraw
    core.draw({ candles: arr, volumes: core.state.volumes });
  }
}

//Обновляет последний столбец объёма
export function updateLastVolume(candle) {
  const core = window.chartCore;
  if (!core || !core.state?.volumes) return;

  const arr = core.state.volumes;
  const vol = parseFloat(candle.volume);
  const point = { time: candle.timestamp, value: isNaN(vol) ? 0 : vol };

  if (candle.isFinal) {
    arr.shift();
    arr.push(point);
  } else {
    arr[arr.length - 1] = point;
  }

  // для упрощения — полный redraw через chartCore.draw
  core.draw({ candles: core.state.candles, volumes: arr });
}
