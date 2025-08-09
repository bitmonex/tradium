import asyncio
import logging
import os
import signal
import uvicorn

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from router import router
from modules.desk import desk_bp
from cex.binance import start_binance
from cex.coinpaprika import start_coinpaprika

# Логирование
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('fastapi')

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Cold start: initializing Redis if needed...")
    from tickers import initialize_redis_from_mongo
    await initialize_redis_from_mongo()
    asyncio.create_task(start_binance())
    asyncio.create_task(start_coinpaprika(interval=300))
    yield
    log.info("Lifespan завершён")


app = FastAPI(lifespan=lifespan)

# Шаблоны и статика
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(router)
app.include_router(desk_bp)

# 404 handler
@app.exception_handler(404)
async def not_found(request: Request, exc: HTTPException):
    headers = {"Cache-Control": "public, max-age=3600"}
    log.error(f"404 Error: {request.url.path}")
    return templates.TemplateResponse("404.html", {"request": request}, status_code=404, headers=headers)

# Запуск
def StartServer():
    log.info("Tradium Server : 5002")
    uvicorn.run(app, host='0.0.0.0', port=5002)

# Завершение
def ShutDown(signal, frame):
    log.info("Tradium Server : Off")
    os._exit(0)

signal.signal(signal.SIGINT, ShutDown)

# Tradium
if __name__ == "__main__":
    try:
        StartServer()
    except KeyboardInterrupt:
        ShutDown(None, None)
