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
        # Idempotentne — jeśli broadcast już wyrzucił duch-socket, .remove() rzuca ValueError.
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Wysyła wiadomość do wszystkich podłączonych klientów.

        Czyści martwe sockety po wyjątkach send_json — wcześniej
        return_exceptions=True zjadał błędy, duch-socket zostawał na liście,
        każdy broadcast iterował po duchach i spowalniał system.
        """
        if not self.active_connections:
            return

        # Snapshot: broadcast nie może być wrażliwy na równoległe
        # connect/disconnect podczas iteracji.
        connections = list(self.active_connections)
        tasks = [conn.send_json(message) for conn in connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for conn, res in zip(connections, results):
            if isinstance(res, Exception) and conn in self.active_connections:
                self.active_connections.remove(conn)

manager = ConnectionManager()
