import json
import logging
import threading
from fastapi import APIRouter, HTTPException
from websocket import create_connection

heatmap_bp = APIRouter()
logging.basicConfig(level=logging.DEBUG)

market_data_cache = []

def fetch_market_data():
    try:
        ws = create_connection("wss://stream.binance.com:9443/ws/!ticker@arr")
        ping_interval=10,
        ping_timeout=20,
        logging.info("WebSocket connection established")
        while True:
            result = ws.recv()
            logging.debug(f"Received data: {result}")
            data = json.loads(result)

            global market_data_cache
            
            filtered_data = [
                item for item in data
                if item['s'].endswith('USDT') and item['s'] not in ['USDCUSDT', 'FDUSDUSDT','EURUSDT','PEPEUSDT']
            ]

            sorted_data = sorted(filtered_data, key=lambda x: float(x['q']), reverse=True)[:350]

            market_data_cache = [
                {
                    'symbol': item['s'],
                    'price': float(item['c']),
                    'price_change': float(item['P']),
                    'market_cap': float(item['q']),
                    'volume_24h': float(item['v']),
                    'supply': float(item['Q'])
                }
                for item in sorted_data
            ]

            logging.debug(f"Market data cache updated: {market_data_cache}")

    except Exception as e:
        logging.error(f"Error fetching market data from WebSocket: {str(e)}")

threading.Thread(target=fetch_market_data, daemon=True).start()

@heatmap_bp.get("/api/heatmap")
async def get_market_data(page: int = 0, limit: int = 350):
    try:
        start = page * limit
        end = start + limit

        if start >= len(market_data_cache):
            return []

        return market_data_cache[start:end]
    except Exception as e:
        logging.error(f"Exception occurred while fetching market data: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching market data")

@heatmap_bp.get("/api/top")
async def get_tops():
    try:
        sorted_data = sorted(market_data_cache, key=lambda x: x['price_change'])
        losers = sorted_data[:15]
        gainers = sorted_data[-16:][::-1]

        return {
            "gainers": gainers,
            "losers": losers
        }
    except Exception as e:
        logging.error(f"Exception occurred while fetching top movers: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching top movers")
