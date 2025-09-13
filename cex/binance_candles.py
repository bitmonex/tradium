import os
import sys
import time
import requests
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import db

def fetch_recent_klines(symbol, tf, market_type="spot", limit=1000):
    base_url = "https://api.binance.com/api/v3/klines" if market_type == "spot" else "https://fapi.binance.com/fapi/v1/klines"
    params = {
        "symbol": symbol.upper(),
        "interval": tf,
        "limit": limit
    }
    response = requests.get(base_url, params=params)
    data = response.json()
    return data

def save_klines(symbol, tf, klines, market_type="spot"):
    collection = f"binance_{market_type}_candles_{tf}"
    for k in klines:
        ts = k[0] // 1000
        candle = {
            "symbol": symbol.upper(),
            "timestamp": ts,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
            "openTime": ts,
            "closeTime": k[6] // 1000,
            "isFinal": True,
            "price": float(k[4])
        }
        db[collection].update_one({"symbol": symbol.upper(), "timestamp": ts}, {"$set": candle}, upsert=True)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Укажи тикер: python3 binance_candles.py btcusdt")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    timeframes = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w", "1M"]

    for tf in timeframes:
        klines = fetch_recent_klines(symbol, tf)
        save_klines(symbol, tf, klines)
        print(f"✅ {symbol} {tf}: {len(klines)} последних свечей загружено")
