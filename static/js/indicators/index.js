// indicators/index.js
import { test } from './test.js';
import { volume } from './volume.js';
import { ma } from './ma.js';
import { sma } from './sma.js';
import { rsi } from './rsi.js';
import { tsi } from './tsi.js';
import { trendStrength } from './trend-strength.js';
import { atr } from './atr.js';
import { volatilityOHLC } from './volatility-ohlc.js';

export const Indicators = {
  volume,
  ma,
  sma,
  rsi,
  tsi,
  trendStrength,
  atr,
  volatilityOHLC,
  test
};

