import asyncio
import websockets
import json
import time
import math
from db import db
from datetime import datetime
from tickers import save_ticker_data
from ws.manager import ws_manager

SPOT_WS_URL = "wss://stream.binance.com:9443/ws/!ticker@arr"
FUTURES_WS_URL = "wss://fstream.binance.com/ws/!ticker@arr"

queue = asyncio.Queue()
live_candles = {}
last_msg_time = {}

# ====== Обработчики тикеров ======

async def spot_ws_handler():
    name = "spot_ticker"
    while True:
        try:
            async with websockets.connect(SPOT_WS_URL, ping_interval=20, ping_timeout=20) as ws:
                print("[spot_ws_handler] Connected")
                last_msg_time[name] = time.time()
                async for msg in ws:
                    last_msg_time[name] = time.time()
                    try:
                        data = json.loads(msg)
                        for t in data:
                            t["market_type"] = "spot"
                            await queue.put(t)
                    except Exception as e:
                        print("[spot_ws_handler] Error:", e)
        except Exception as e:
            print("[spot_ws_handler] Connection error:", e)
            await asyncio.sleep(5)

async def futures_ws_handler():
    name = "futures_ticker"
    while True:
        try:
            async with websockets.connect(FUTURES_WS_URL, ping_interval=20, ping_timeout=20) as ws:
                print("[futures_ws_handler] Connected")
                last_msg_time[name] = time.time()
                async for msg in ws:
                    last_msg_time[name] = time.time()
                    try:
                        data = json.loads(msg)
                        for t in data:
                            t["market_type"] = "futures"
                            await queue.put(t)
                    except Exception as e:
                        print("[futures_ws_handler] Error:", e)
        except Exception as e:
            print("[futures_ws_handler] Connection error:", e)
            await asyncio.sleep(5)

# ====== Консьюмер ======

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

# ====== Новый мульти‑подписочный обработчик свечей ======

async def kline_multi_ws_handler(market_type, symbols, tf):
    name = f"{market_type}_{tf}"
    base_url = "wss://stream.binance.com:9443/stream?streams=" if market_type == "spot" else "wss://fstream.binance.com/stream?streams="
    streams = "/".join(f"{s.lower()}@kline_{tf}" for s in symbols)
    ws_url = f"{base_url}{streams}"

    while True:
        try:
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                print(f"[kline_multi_ws_handler] Connected {market_type} {tf} ({len(symbols)} symbols)")
                last_msg_time[name] = time.time()
                async for msg in ws:
                    last_msg_time[name] = time.time()
                    try:
                        data = json.loads(msg)
                        stream = data.get("stream", "")
                        k = data["data"]["k"]

                        full_symbol = k["s"].upper()
                        if market_type == "futures":
                            full_symbol += "PERP"

                        timestamp = int(k["t"]) / 1000
                        close_time = int(k["T"]) // 1000
                        timer = max(0, math.floor(close_time - time.time()))

                        candle = {
                            "symbol":     full_symbol,
                            "timestamp":  timestamp,
                            "open":       float(k["o"]),
                            "high":       float(k["h"]),
                            "low":        float(k["l"]),
                            "close":      float(k["c"]),
                            "volume":     float(k["v"]),
                            "openTime":   int(k["t"]) // 1000,
                            "closeTime":  close_time,
                            "isFinal":    k["x"],
                            "price":      float(k["c"]),
                            "timer": timer
                        }

                        exchange = "binance"
                        collection_name = f"{exchange}_{market_type}_candles_{tf}"

                        await db[collection_name].update_one(
                            {"symbol": full_symbol, "timestamp": timestamp},
                            {"$set": candle},
                            upsert=True
                        )

                        room = f"{exchange}:{market_type}:{full_symbol}:{tf}"
                        live_candles[room] = {
                            "closeTime": close_time,
                            "symbol": full_symbol,
                            "exchange": exchange,
                            "market_type": market_type,
                            "tf": tf
                        }
                        await ws_manager.broadcast(room, json.dumps(candle))

                    except Exception as e:
                        print(f"[kline_multi_ws_handler] Error {market_type}/{tf}: {e}")
        except Exception as e:
            print(f"[kline_multi_ws_handler] Connection error {market_type}/{tf}: {e}")
            await asyncio.sleep(5)

# ====== Watchdog ======

async def watchdog(timeout=30):
    while True:
        await asyncio.sleep(5)
        now = time.time()
        for name, last_time in list(last_msg_time.items()):
            if now - last_time > timeout:
                print(f"[watchdog] {name} stale for {int(now - last_time)}s — consider reconnect")

# ====== Таймер ======

async def timer_broadcaster():
    while True:
        now = int(time.time())
        for room, info in live_candles.items():
            close_time = info["closeTime"]
            timer = max(0, close_time - now)

            payload = {
                "symbol": info["symbol"],
                "exchange": info["exchange"],
                "market_type": info["market_type"],
                "tf": info["tf"],
                "timer": timer
            }

            await ws_manager.broadcast(room, json.dumps(payload))

        await asyncio.sleep(1)

# ====== Старт ======

async def start_binance():
    timeframes = [
        "1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w", "1M"
    ]
    # Здесь можно указать хоть весь список тикеров
    symbols = [
        "btcusdt", "ethusdt", "bnbusdt", "xrpusdt"
    ]

    tasks = [
        spot_ws_handler(),
        futures_ws_handler(),
        consumer(),
        timer_broadcaster(),
        watchdog()
    ]

    for tf in timeframes:
        tasks.append(kline_multi_ws_handler("spot", symbols, tf))
        tasks.append(kline_multi_ws_handler("futures", symbols, tf))

    await asyncio.gather(*tasks)
