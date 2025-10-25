import asyncio
from db import db

async def main():
    spot_count = await db.tickers.count_documents({})
    futures_count = await db.tickers_futures.count_documents({})

    spot_sample = await db.tickers.find_one()
    futures_sample = await db.tickers_futures.find_one()

    print("spot count:", spot_count)
    print("futures count:", futures_count)
    print("spot sample:", spot_sample)
    print("futures sample:", futures_sample)

if __name__ == "__main__":
    asyncio.run(main())
