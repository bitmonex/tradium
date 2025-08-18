import httpx
import logging
import time
import re
import asyncio
from bs4 import BeautifulSoup
from fastapi import APIRouter
from fastapi.responses import JSONResponse

desk_bp = APIRouter()
logging.basicConfig(level=logging.INFO)



@desk_bp.get("/api/wm")
async def get_market_list():
    return JSONResponse(content={"data": await get_or_cache("main", fetch_indeces)})

@desk_bp.get("/api/commodities")
async def get_commodities():
    return JSONResponse(content={"data": await get_or_cache("commodities", fetch_commodities)})

@desk_bp.get("/api/bonds")
async def get_bonds():
    return JSONResponse(content={"data": await get_or_cache("bonds", fetch_bonds)})
