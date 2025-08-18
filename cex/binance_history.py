import aiohttp
import asyncio
import time
from datetime import datetime
from db import db

BASE_URL = "https://api.binance.com/api/v3/klines"

# Все доступные TF
TIMEFRAMES = list(reversed([
    "1m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h",
    "12h", "1d", "3d", "1w", "1M"
]))


# В миллисекундах
TF_TO_MS = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1800_000,
    "1h": 3600_000, "2h": 7200_000, "4h": 14_400_000, "6h": 21_600_000,
    "12h": 43_200_000, "1d": 86_400_000, "3d": 259_200_000,
    "1w": 604_800_000, "1M": 2_592_000_000
}

async def fetch_klines(session, symbol, tf, start_ms, retries=3):
    for i in range(retries):
        try:
            async with session.get(BASE_URL, params={
                "symbol": symbol.upper(),
                "interval": tf,
                "limit": 1000,
                "startTime": start_ms
            }) as res:
                if res.status != 200:
                    text = await res.text()
                    print(f"❌ {symbol} {tf}: HTTP {res.status} → {text}")
                    return []
                return await res.json()
        except Exception as e:
            print(f"⚠️ Retry {i+1} for {symbol} {tf}: {e}")
            await asyncio.sleep(1)  # пауза 1 сек
    return []

async def load_symbol(symbol):
    print(f"\n📥 Загрузка {symbol.upper()}...")

    async with aiohttp.ClientSession() as session:
        for tf in TIMEFRAMES:
            print(f"⏳ {symbol} / {tf}...")
            tf_ms = TF_TO_MS[tf]
            end_time = int(time.time() * 1000)
            start_time = 1500000000000  # С 2017 года

            collection = db[f"binance_spot_candles_{tf}"]
            while start_time < end_time:
                klines = await fetch_klines(session, symbol, tf, start_time)
                if not klines:
                    break

                docs = []
                for k in klines:
                    doc = {
                        "symbol": symbol.upper(),
                        "timestamp": k[0] // 1000,
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5])
                    }
                    docs.append(doc)

                for d in docs:
                    await collection.update_one(
                        {"symbol": d["symbol"], "timestamp": d["timestamp"]},
                        {"$set": d},
                        upsert=True
                    )

                last = klines[-1][0]
                start_time = last + tf_ms

                print(f"✅ {symbol} {tf}: {len(klines)} свечей с {datetime.utcfromtimestamp(klines[0][0]//1000)}")

    print(f"✅ Загрузка {symbol.upper()} завершена.")


async def load_all():
    symbols = await db.tickers.distinct("symbol")
    symbols = [s.lower().replace("perp", "") for s in symbols if s.endswith("USDT")]
    for sym in symbols:
        await load_symbol(sym)

if __name__ == "__main__":
    import sys
    asyncio.run(load_all() if len(sys.argv) < 2 or sys.argv[1] == "all" else load_symbol(sys.argv[1].lower()))
