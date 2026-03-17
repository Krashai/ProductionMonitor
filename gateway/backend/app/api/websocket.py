import asyncio
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Lista aktywnych połączeń WebSocket
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Wysyła wiadomość do wszystkich podłączonych klientów."""
        if not self.active_connections:
            return
            
        # Tworzymy listę zadań do wysłania, aby robić to współbieżnie
        tasks = [
            connection.send_json(message) 
            for connection in self.active_connections
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

manager = ConnectionManager()
