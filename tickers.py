from db import db, redis_client
import json

async def initialize_redis_from_mongo():
    if redis_client.get("initialized"):
        print("[init] Redis already initialized. Skipping.")
        return

    print("[init] Redis is empty or not marked initialized. Restoring from MongoDB...")
    tickers = await db.tickers.find().to_list(None)
    for t in tickers:
        symbol = t["symbol"]
        redis_client.set(symbol, json.dumps(t))
    
    redis_client.set("initialized", "1")
    print(f"[init] Restored {len(tickers)} tickers into Redis.")


async def save_ticker_data(data: dict):
    symbol = data["symbol"]
    exchange = data["exchange"]
    market_type = data["market_type"]
    key = f"{exchange}:{market_type}:{symbol}"

    await db.tickers.update_one({"_id": key}, {"$set": data}, upsert=True)
    redis_client.set(key, json.dumps(data))

async def get_ticker_data(exchange: str, market_type: str, symbol: str):
    key = f"{exchange.lower()}:{market_type.lower()}:{symbol.upper()}"

    data = redis_client.get(key)
    if data:
        return json.loads(data)
    
    doc = await db.tickers.find_one({"_id": key})
    if doc:
        redis_client.set(key, json.dumps(doc))
    return doc

