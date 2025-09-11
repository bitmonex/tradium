import requests
import datetime

symbol = "LINEAUSDT"
limit = 1000  # максимум за один запрос
base_url = "https://api.binance.com/api/v3/aggTrades"

params = {
    "symbol": symbol,
    "limit": limit,
    "fromId": 0  # начинаем с самого первого ID
}

response = requests.get(base_url, params=params)
trades = response.json()

# Выводим первые 10 сделок
for trade in trades[:10]:
    time_ms = trade["T"]
    time_str = datetime.datetime.fromtimestamp(time_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')
    print(f"ID: {trade['a']}, Price: {trade['p']}, Qty: {trade['q']}, Time: {time_str}")
