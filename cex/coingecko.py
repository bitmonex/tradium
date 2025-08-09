import asyncio
import logging
import httpx
import json
import math
from datetime import datetime
from db import db, redis_client

log = logging.getLogger("coingecko")

GECKO_MARKET_URL = "https://api.coingecko.com/api/v3/coins/markets"

CUSTOM_MAPPING = {
    "AEUR": "anchored-coins-eur",
    "MKR": "maker",
    "XNO": "nano",
    "ETHFI": "ether-fi",
    "DOGS": "dogswap",
    "1MBABYDOGE": "1mbabydoge",
    "VOXEL": "voxies",
    "FORM": "formation-fi",
    "NXPC": "nexpace",
    "A": "aave",
    "COS": "contentos",
    "LAZIO": "lazio-fan-token",
    "CHESS": "tranchess",
    "ADX": "adex",
    "PORTAL": "portal",
    "BAR": "fc-barcelona-fan-token",
    "BEAM": "onbeam",
    "HIFI": "hifi-finance",
    "STX": "stacks",
    "BSW": "biswap",
    "HIGH": "highstreet",
    "1000CAT": "cat-in-a-box",
    "ALPINE": "alpine-f1-team-fan-token",
    "ASR": "as-roma-fan-token",
    "1000SATS": "sats-ordinals",
    "RONIN": "ronin",
    "1000CHEEMS": "cheems-inu",
    "THE": "the-tokenized-bitcoin",
    "VELODROME": "velodrome-finance",
    "FIO": "fio-protocol",
    "ATM": "atletico-madrid-fan-token",
    "ACM": "ac-milan-fan-token",
    "FXS": "frax-share",
    "TKO": "tokocrypto",
    "BROCCOLI714": "broccoli714",
    "UTK": "utrust",
    "LTO": "lto-network",
    "FTT": "ftx-token",
    "JUV": "juventus-fan-token",
    "PORTO": "fc-porto",
    "PIVX": "pivx",
    "CITY": "manchester-city-fan-token",
    "GTC": "gitcoin",
    "DATA": "streamr",
    "MDT": "measurable-data-token",
    "EURI": "stasis-eurs",
    "BTC": "bitcoin",
    "SXT": "space-and-time",
}


def match_coin_by_symbol(symbol, gecko_coins):
    symbol = symbol.upper()
    candidates = [c for c in gecko_coins if c["symbol"].upper() == symbol]
    candidates = sorted(candidates, key=lambda c: c.get("market_cap") or 0, reverse=True)
    return candidates[0] if candidates else None


async def fetch_all_market_data():
    coins = []
    page = 1
    while True:
        log.info(f"Запрос страницы {page} с CoinGecko")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    GECKO_MARKET_URL,
                    params={
                        "vs_currency": "usd",
                        "order": "market_cap_desc",
                        "per_page": 250,
                        "page": page,
                        "sparkline": "false"
                    },
                    timeout=30
                )
                if response.status_code == 429:
                    log.warning("Превышен лимит CoinGecko. Пауза 3мин")
                    await asyncio.sleep(240)
                    continue

                response.raise_for_status()
                data = response.json()
                if not data:
                    break
                coins.extend(data)
                page += 1
                await asyncio.sleep(2)
        except Exception as e:
            log.error(f"Ошибка при запросе CoinGecko (страница {page}): {e}")
            break
    log.info(f"CoinGecko получено: {len(coins)}")
    return coins


def clean_ticker_data_for_redis(ticker_data):
    """Удаляет _id и сериализует datetime в строку"""
    ticker_data.pop("_id", None)
    if isinstance(ticker_data.get("updated"), datetime):
        ticker_data["updated"] = ticker_data["updated"].isoformat()
    return ticker_data


async def update_market_caps():
    tickers = await db.tickers.find().to_list(None)
    if not tickers:
        log.warning("Нет тикеров в базе")
        return

    gecko_coins = await fetch_all_market_data()
    gecko_map_by_id = {coin["id"]: coin for coin in gecko_coins}

    updated = 0

    for ticker in tickers:
        symbol = ticker["symbol"]
        base = symbol.replace("PERP", "")
        base = base[:-4].upper() if base.endswith("USDT") else base.upper()
        coin = None
        mapped_id = CUSTOM_MAPPING.get(base)
        if mapped_id:
            coin = gecko_map_by_id.get(mapped_id)
            if coin:
                log.info(f"[MAPPED] {symbol} → {mapped_id} → {coin['market_cap']}")
        if not coin:
            coin = match_coin_by_symbol(base, gecko_coins)
            if coin:
                log.info(f"[MATCHED] {symbol} → {coin['id']} → {coin['market_cap']}")
            else:
                log.warning(f"[MISSING] Не найден CoinGecko coin для {symbol} (base={base})")

        market_cap = coin.get("market_cap") if coin else None
        market_vol = coin.get("total_volume") if coin else None
        log.info(f"[{symbol}] market_cap={market_cap}, market_vol={market_vol}")

        if market_cap is not None:
            try:
                if isinstance(market_cap, str):
                    market_cap = float(market_cap.replace(",", "")
                                                   .replace("b", "e9")
                                                   .replace("m", "e6"))
                if math.isnan(market_cap):
                    continue

                base_symbol_variants = [symbol.replace("PERP", ""), symbol + "PERP"] if not symbol.endswith("PERP") else [symbol, symbol.replace("PERP", "")]

                await db.tickers.update_many(
                    {"symbol": {"$in": base_symbol_variants}},
                    {
                        "$set": {
                            "market_cap": int(market_cap) if market_cap else 0,
                            "market_vol": int(market_vol) if market_vol else 0
                        }
                    }
                )

                for s in base_symbol_variants:
                    ticker_data = await db.tickers.find_one({"symbol": s})
                    if ticker_data:
                        redis_key = f"cex:{s}"
                        redis_client.set(
                            redis_key,
                            json.dumps(clean_ticker_data_for_redis(ticker_data))
                        )

                updated += 1
            except Exception as e:
                log.error(f"Ошибка обработки market_cap для {symbol}: {e}")

    log.info(f"Обновлено: {updated} из {len(tickers)}")


async def start_coingecko(interval: int = 300):
    log.info(f"Старт CoinGecko (интервал: {interval} сек)")
    while True:
        try:
            await update_market_caps()
        except Exception as e:
            log.exception(f"[CoinGecko] Ошибка обновления: {e}")
        await asyncio.sleep(interval)
