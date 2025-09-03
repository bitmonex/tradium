# ws/manager.py

from typing import Dict, List
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        # ключ — имя «комнаты», значение — список WebSocket
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, room: str):
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(ws)

    async def disconnect(self, ws: WebSocket):
        # удаляем ws из всех комнат
        for room, conns in self.active_connections.items():
            if ws in conns:
                conns.remove(ws)

    async def broadcast(self, room: str, message: str):
        # рассылаем message всем в комнате
        conns = self.active_connections.get(room, [])
        for conn in conns:
            await conn.send_text(message)

# глобальный инстанс
ws_manager = ConnectionManager()
