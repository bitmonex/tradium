import asyncio
import websockets
import json
from db import db
from datetime import datetime
from tickers import save_ticker_data
from ws.manager import ws_manager

SPOT_WS_URL = "wss://stream.binance.com:9443/ws/!ticker@arr"
FUTURES_WS_URL = "wss://fstream.binance.com/ws/!ticker@arr"

queue = asyncio.Queue()

# Обработчик спота
async def spot_ws_handler():
    async with websockets.connect(SPOT_WS_URL) as ws:
        async for msg in ws:
            try:
                data = json.loads(msg)
                for t in data:
                    t["market_type"] = "spot"
                    await queue.put(t)
            except Exception as e:
                print("[spot_ws_handler] Error:", e)

# Обработчик фьючерсов
async def futures_ws_handler():
    async with websockets.connect(FUTURES_WS_URL) as ws:
        async for msg in ws:
            try:
                data = json.loads(msg)
                for t in data:
                    t["market_type"] = "futures"
                    await queue.put(t)
            except Exception as e:
                print("[futures_ws_handler] Error:", e)

# Основной консьюмер
async def consumer():
    while True:
        t = await queue.get()
        try:
            raw_symbol = t["s"].upper()

            excluded_pairs = {"USD1USDT", "TUSDT"}
            if raw_symbol in excluded_pairs:
                continue

            if t["market_type"] == "spot" and not raw_symbol.endswith("USDT"):
                continue
            if t["market_type"] == "futures" and not raw_symbol.endswith("USDT"):
                continue

            symbol = raw_symbol
            if t["market_type"] == "futures":
                symbol += "PERP"

            price = float(t["c"])
            price_change = float(t["P"])
            volume_24h = float(t["q"])
            market_vol = float(t["v"])

            ticker_obj = {
                "symbol": symbol,
                "price": price,
                "price_change": price_change,
                "volume_24h": volume_24h,
                "market_vol": market_vol,
                "market_cap": None,
                "exchange": "binance",
                "market_type": t["market_type"],
                "updated": datetime.utcnow().isoformat()
            }

            await save_ticker_data(ticker_obj)
        except Exception as e:
            print("[consumer] Error:", e)

# Обработчик свечей
async def kline_ws_handler(market_type, symbol, tf):
    base_url = "wss://stream.binance.com:9443/ws" if market_type == "spot" else "wss://fstream.binance.com/ws"
    symbol_ws = symbol.lower()
    ws_url = f"{base_url}/{symbol_ws}@kline_{tf}"

    async with websockets.connect(ws_url) as ws:
        async for msg in ws:
            try:
                data = json.loads(msg)
                k = data["k"]

                full_symbol = symbol.upper()
                if market_type == "futures":
                    full_symbol += "PERP"

                timestamp = int(k["t"]) / 1000

                candle = {
                    "symbol":     full_symbol,
                    "timestamp":  timestamp,
                    "open":       float(k["o"]),
                    "high":       float(k["h"]),
                    "low":        float(k["l"]),
                    "close":      float(k["c"]),
                    "volume":     float(k["v"]),
                    "openTime":   int(k["t"]) // 1000,
                    "closeTime":  int(k["T"]) // 1000,
                    "isFinal":    k["x"]
                }

                exchange = "binance"
                collection_name = f"{exchange}_{market_type}_candles_{tf}"

                await db[collection_name].update_one(
                    {"symbol": full_symbol, "timestamp": timestamp},
                    {"$set": candle},
                    upsert=True
                )

                # 🔔 Рассылаем клиентам в нужную комнату
                room = f"{exchange}:{market_type}:{full_symbol}:{tf}"
                await ws_manager.broadcast(room, json.dumps(candle))

            except Exception as e:
                print(f"[kline_ws_handler] Error {market_type}/{tf}: {e}")

# Главная точка запуска
async def start_binance():
    timeframes = [
        "1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w", "1M"
    ]
    symbols = [
    "btcusdt", "ethusdt"
    ]

    tasks = [
        spot_ws_handler(),
        futures_ws_handler(),
        consumer()
    ]

    for tf in timeframes:
        for symbol in symbols:
            tasks.append(kline_ws_handler("spot", symbol, tf))
            tasks.append(kline_ws_handler("futures", symbol, tf))

    await asyncio.gather(*tasks)
