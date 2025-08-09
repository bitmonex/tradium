import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse

ping_bp = APIRouter()

@ping_bp.get("/ping")
async def ping():
    start_time = time.time()
    time.sleep(0.01)
    server_latency = (time.time() - start_time) * 1000

    return JSONResponse(content={
        "server_ping": f"{server_latency:.2f} ms"
    })
