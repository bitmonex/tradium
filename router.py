from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from db import db, redis_client
from bson import ObjectId

from modules.ping import ping_bp
from modules.desk import desk_bp
from modules.img import router as img_bp
from modules.heatmap import heatmap_bp

from tickers import save_ticker_data, get_ticker_data
from ws.manager import ws_manager

templates = Jinja2Templates(directory="templates")

router = APIRouter()
router.include_router(ping_bp)
router.include_router(desk_bp)
router.include_router(img_bp)
router.include_router(heatmap_bp)


# Index
@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Desk
@router.get("/desk", response_class=HTMLResponse)
async def desk(request: Request):
    return templates.TemplateResponse("desk.html", {"request": request})


# Heatmap
@router.get("/heatmap", response_class=HTMLResponse)
async def market(request: Request):
    return templates.TemplateResponse("heatmap.html", {"request": request})


# Ticker page
@router.get("/{exchange}/{market_type}/{symbol}", response_class=HTMLResponse)
async def get_ticker_page(
    request: Request,
    exchange: str,
    market_type: str,
    symbol: str
):
    if symbol != symbol.upper():
        return RedirectResponse(url=f"/{exchange}/{market_type}/{symbol.upper()}")

    key = f"{exchange}:{market_type}:{symbol}"
    ticker_info = await db.tickers.find_one({"_id": key})

    if not ticker_info:
        raise HTTPException(status_code=404, detail="Ticker not found")

    return templates.TemplateResponse("ticker.html", {
        "request": request,
        "exchange": exchange,
        "market_type": market_type,
        "symbol": symbol,
        "ticker_info": ticker_info
    })


# History (candles)
@router.get("/{exchange}/{market_type}/{symbol}/history")
async def get_candles(
    exchange: str,
    market_type: str,
    symbol: str,
    tf: str = Query("1m"),
    limit: int = Query(2000),
    before: int = Query(None)  # Unix timestamp
):
    collection_name = f"{exchange}_{market_type}_candles_{tf}"
    query = {"symbol": symbol}
    if before:
        query["timestamp"] = {"$lt": before}

    cursor = db[collection_name].find(query).sort("timestamp", -1)
    if limit:
        cursor = cursor.limit(limit)

    history = await cursor.to_list(None)
    for candle in history:
        candle["_id"] = str(candle["_id"])
    # возвращаем в хронологическом порядке
    return history[::-1]


# JSON список тикеров
@router.get("/tickers/json")
async def tickers_json():
    tickers = await db.tickers.find().to_list(None)
    for ticker in tickers:
        ticker["_id"] = str(ticker["_id"])
    return tickers


# Список тикеров в HTML
@router.get("/tickers", response_class=HTMLResponse)
async def tickers_list(request: Request):
    tickers = await db.tickers.find().to_list(None)
    ticker_count = len(tickers)
    return templates.TemplateResponse("tickers.html", {
        "request": request,
        "tickers": tickers,
        "ticker_count": ticker_count
    })


# WebSocket-роут для K-line в реальном времени
@router.websocket("/ws/kline")
async def kline_ws(
    websocket: WebSocket,
    exchange: str     = Query(...),
    market_type: str  = Query(...),
    symbol: str       = Query(...),
    tf: str           = Query("1m"),
):
    """
    Подключиться можно так:
    wss://<ваш-домен>/ws/kline?exchange=binance&market_type=spot&symbol=BTCUSDT&tf=1m
    """
    await websocket.accept()
    room = f"{exchange}:{market_type}:{symbol.upper()}:{tf}"

    # регистрируем вебсокет в комнате
    await ws_manager.connect(websocket, room)

    try:
        # держим соединение живым
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
