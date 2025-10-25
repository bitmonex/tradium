import aiohttp
import asyncio
import time
import signal
from datetime import datetime, timezone
from db import db
from pymongo import UpdateOne

BASE_URLS = {
    "spot": "https://api.binance.com/api/v3/klines",
    "futures": "https://fapi.binance.com/fapi/v1/klines"
}

TIMEFRAMES = list(reversed([
    "1m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h",
    "12h", "1d", "3d", "1w", "1M"
]))

TF_TO_MS = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "6h": 21_600_000,
    "12h": 43_200_000, "1d": 86_400_000, "3d": 259_200_000,
    "1w": 604_800_000, "1M": 2_592_000_000
}

stop_event = asyncio.Event()


async def fetch_klines(session, base_url, symbol, tf, start_ms, end_ms=None, retries=5):
    for i in range(retries):
        try:
            params = {
                "symbol": symbol.upper(),
                "interval": tf,
                "limit": 1000,
                "startTime": int(start_ms)
            }
            if end_ms:
                params["endTime"] = int(end_ms)

            async with session.get(
                base_url,
                params=params,
                timeout=aiohttp.ClientTimeout(total=20)
            ) as res:
                if res.status == 429:
                    print(f"⏳ Throttled {symbol} {tf}, sleeping 60s...")
                    await asyncio.sleep(60)
                    continue
                if res.status != 200:
                    text = await res.text()
                    print(f"❌ {symbol} {tf}: HTTP {res.status} → {text}")
                    return []
                data = await res.json()
                await asyncio.sleep(0.1)  # throttle
                return data
        except Exception as e:
            print(f"⚠️ Retry {i+1} for {symbol} {tf}: {e}")
            await asyncio.sleep(2)
    return []


async def load_symbol(symbol, market="spot", tf_filter=None, start_date=None):
    base_url = BASE_URLS[market]
    collection_prefix = f"binance_{market}_candles"

    api_symbol = symbol.replace("perp", "") if market == "futures" else symbol

    print(f"\n📥 Загрузка {symbol.upper()}... ({market})")

    async with aiohttp.ClientSession() as session:
        for tf in TIMEFRAMES:
            if stop_event.is_set():
                return
            if tf_filter and tf != tf_filter:
                continue

            print(f"⏳ {symbol} / {tf}...")
            tf_ms = TF_TO_MS[tf]
            end_time = int(time.time() * 1000)

            if start_date:
                try:
                    year, month = map(int, start_date.split("-"))
                    start_time = int(datetime(year, month, 1, tzinfo=timezone.utc).timestamp() * 1000)
                    print(f"▶️ Стартуем строго с {datetime.fromtimestamp(start_time//1000, tz=timezone.utc)}")
                except Exception as e:
                    print(f"⚠️ Ошибка парсинга даты {start_date}: {e}")
                    start_time = 1500000000000
            else:
                start_time = 1500000000000

            collection = db[f"{collection_prefix}_{tf}"]

            while start_time < end_time and not stop_event.is_set():
                window_end = min(start_time + 365*24*3600*1000, end_time)

                while start_time < window_end and not stop_event.is_set():
                    klines = await fetch_klines(session, base_url, api_symbol, tf, start_time, window_end)
                    if not klines:
                        break

                    ops = [
                        UpdateOne(
                            {"symbol": symbol.upper(), "timestamp": k[0] // 1000},
                            {"$set": {
                                "symbol": symbol.upper(),
                                "timestamp": k[0] // 1000,
                                "open": float(k[1]),
                                "high": float(k[2]),
                                "low": float(k[3]),
                                "close": float(k[4]),
                                "volume": float(k[5])
                            }},
                            upsert=True
                        )
                        for k in klines
                    ]

                    if ops:
                        await collection.bulk_write(ops, ordered=False)

                    last = klines[-1][0]
                    start_time = int(last + tf_ms)

                    print(
                        f"✅ {symbol} {tf}: {len(klines)} свечей "
                        f"{datetime.fromtimestamp(klines[0][0] // 1000, tz=timezone.utc)} → "
                        f"{datetime.fromtimestamp(klines[-1][0] // 1000, tz=timezone.utc)}"
                    )

                start_time = window_end

    print(f"✅ Загрузка {symbol.upper()} завершена. ({market})")


async def load_all(market="spot", tf_filter=None, start_date=None, concurrency=2):
    symbols = await db.tickers.distinct("symbol", {"market_type": market})

    if market == "spot":
        symbols = [s.lower() for s in symbols if s.lower().endswith("usdt")]
    else:
        symbols = [s.lower() for s in symbols if s.lower().endswith("usdtperp")]

    if not symbols:
        print(f"⚠️ Нет тикеров для {market} в коллекции tickers")
        return

    sem = asyncio.Semaphore(concurrency)

    async def limited(sym):
        async with sem:
            if not stop_event.is_set():
                await load_symbol(sym, market=market, tf_filter=tf_filter, start_date=start_date)

    tasks = [limited(sym) for sym in symbols]
    await asyncio.gather(*tasks)


def _install_signal_handlers():
    loop = asyncio.get_running_loop()
    try:
        loop.add_signal_handler(signal.SIGINT, stop_event.set)
        loop.add_signal_handler(signal.SIGTERM, stop_event.set)
    except NotImplementedError:
        pass


async def _main():
    import sys
    symbol = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    market = sys.argv[2].lower() if len(sys.argv) > 2 else "spot"
    tf = sys.argv[3].lower() if len(sys.argv) > 3 else None
    start_date = sys.argv[4] if len(sys.argv) > 4 else None

    _install_signal_handlers()

    if symbol == "all":
        await load_all(market=market, tf_filter=tf, start_date=start_date)
    else:
        await load_symbol(symbol, market=market, tf_filter=tf, start_date=start_date)


if __name__ == "__main__":
    asyncio.run(_main())
