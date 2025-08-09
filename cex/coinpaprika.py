import httpx
import asyncio
from db import db, redis_client
import json
from datetime import datetime

def clean_ticker_data_for_redis(ticker_data):
    ticker_data.pop("_id", None)
    if isinstance(ticker_data.get("updated"), datetime):
        ticker_data["updated"] = ticker_data["updated"].isoformat()
    return ticker_data

async def fetch_market_data():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.coinpaprika.com/v1/tickers")
        response.raise_for_status()
        return response.json()

async def update_market_caps():
    tickers = await db.tickers.find().to_list(None)
    if not tickers:
        print("Нет тикеров")
        return

    paprika_data = await fetch_market_data()
    paprika_map = {coin["symbol"].upper(): coin for coin in paprika_data}

    base_symbols = set()
    for t in tickers:
        symbol = t["symbol"]
        base = symbol.replace("PERP", "")
        base = base[:-4].upper() if base.endswith("USDT") else base.upper()
        base_symbols.add(base)

    for base in base_symbols:
        coin = paprika_map.get(base)
        if not coin:
            continue

        market_cap = coin["quotes"]["USD"]["market_cap"]
        market_vol = coin["quotes"]["USD"]["volume_24h"]

        for s in [f"{base}USDT", f"{base}USDTPERP"]:
            await db.tickers.update_one(
                {"symbol": s},
                {"$set": {"market_cap": market_cap, "market_vol": market_vol}}
            )
            ticker_data = await db.tickers.find_one({"symbol": s})
            if ticker_data:
                key = f"{ticker_data['exchange']}:{ticker_data['market_type']}:{s}"
                redis_client.set(
                    key,
                    json.dumps(clean_ticker_data_for_redis(ticker_data))
                )

    print("Обновление завершено")

# ✅ Добавлено: экспортируемая функция для FastAPI
async def start_coinpaprika(interval: int = 300):
    while True:
        try:
            await update_market_caps()
        except Exception as e:
            print("[coinpaprika] Error updating market caps:", e)
        await asyncio.sleep(interval)
