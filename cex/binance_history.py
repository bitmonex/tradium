import aiohttp
import asyncio
import time
from datetime import datetime, timezone
from db import db
from pymongo import UpdateOne

BASE_URL = "https://api.binance.com/api/v3/klines"

# Все доступные TF
TIMEFRAMES = list(reversed([
    "1m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h",
    "12h", "1d", "3d", "1w", "1M"
]))

# В миллисекундах
TF_TO_MS = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "6h": 21_600_000,
    "12h": 43_200_000, "1d": 86_400_000, "3d": 259_200_000,
    "1w": 604_800_000, "1M": 2_592_000_000
}


async def fetch_klines(session, symbol, tf, start_ms, retries=3):
    for i in range(retries):
        try:
            print(f"→ fetch {symbol} {tf} start={start_ms} "
                  f"({datetime.fromtimestamp(start_ms//1000, tz=timezone.utc)})")
            async with session.get(
                BASE_URL,
                params={
                    "symbol": symbol.upper(),
                    "interval": tf,
                    "limit": 1000,
                    "startTime": start_ms
                },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as res:
                if res.status != 200:
                    text = await res.text()
                    print(f"❌ {symbol} {tf}: HTTP {res.status} → {text}")
                    return []
                return await res.json()
        except Exception as e:
            print(f"⚠️ Retry {i+1} for {symbol} {tf}: {e}")
            await asyncio.sleep(1)
    return []


async def load_symbol(symbol, tf_filter=None, start_date=None):
    print(f"\n📥 Загрузка {symbol.upper()}...")

    async with aiohttp.ClientSession() as session:
        for tf in TIMEFRAMES:
            if tf_filter and tf != tf_filter:
                continue

            print(f"⏳ {symbol} / {tf}...")
            tf_ms = TF_TO_MS[tf]
            end_time = int(time.time() * 1000)

            # --- стартовая дата ---
            if start_date:
                try:
                    year, month = map(int, start_date.split("-"))
                    start_time = int(datetime(year, month, 1, tzinfo=timezone.utc).timestamp() * 1000)
                except Exception as e:
                    print(f"⚠️ Ошибка парсинга даты {start_date}: {e}")
                    start_time = 1500000000000
            else:
                start_time = 1500000000000  # дефолт: 2017

            collection = db[f"binance_spot_candles_{tf}"]

            while start_time < end_time:
                klines = await fetch_klines(session, symbol, tf, start_time)
                if not klines:
                    print(f"⚠️ Нет данных для {symbol} {tf} начиная с {start_time}")
                    break

                ops = []
                for k in klines:
                    d = {
                        "symbol": symbol.upper(),
                        "timestamp": k[0] // 1000,
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5])
                    }
                    ops.append(UpdateOne(
                        {"symbol": d["symbol"], "timestamp": d["timestamp"]},
                        {"$set": d},
                        upsert=True
                    ))

                if ops:
                    await collection.bulk_write(ops, ordered=False)

                last = klines[-1][0]
                start_time = last + tf_ms

                print(
                    f"✅ {symbol} {tf}: {len(klines)} свечей с "
                    f"{datetime.fromtimestamp(klines[0][0] // 1000, tz=timezone.utc).isoformat()}"
                )

    print(f"✅ Загрузка {symbol.upper()} завершена.")


async def load_all(tf_filter=None, start_date=None):
    symbols = await db.tickers.distinct("symbol")
    symbols = [s.lower().replace("perp", "") for s in symbols if s.endswith("USDT")]
    for sym in symbols:
        await load_symbol(sym, tf_filter=tf_filter, start_date=start_date)


if __name__ == "__main__":
    import sys
    symbol = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    tf = sys.argv[2].lower() if len(sys.argv) > 2 else None
    start_date = sys.argv[3] if len(sys.argv) > 3 else None  # формат YYYY-MM

    if symbol == "all":
        asyncio.run(load_all(tf_filter=tf, start_date=start_date))
    else:
        asyncio.run(load_symbol(symbol, tf_filter=tf, start_date=start_date))
