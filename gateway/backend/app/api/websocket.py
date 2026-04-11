import asyncio
import logging
from typing import List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Menedżer połączeń WebSocket dla broadcastów PLC_UPDATE.

    Niezawodność:
    - Lista jest mutowana zarówno z handlera WebSocket (event loop) jak i z wątków
      PLCWorker przez `asyncio.run_coroutine_threadsafe(broadcast(...))`. Wszystkie
      mutacje i iteracje są chronione asyncio.Lock.
    - `broadcast()` iteruje po SNAPSHOTie listy (pod lockiem), wysyła poza lockiem
      i sprząta martwe połączenia po wynikach `gather`. Bez tego martwe sockety
      gromadziły się w nieskończoność, a `list.remove()` race'ował z iteracją
      generując RuntimeError "list changed size during iteration".
    """

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            try:
                self.active_connections.remove(websocket)
            except ValueError:
                # Już usunięty (np. przez cleanup w broadcast) — idempotentne.
                pass

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            snapshot = list(self.active_connections)

        if not snapshot:
            return

        results = await asyncio.gather(
            *(conn.send_json(message) for conn in snapshot),
            return_exceptions=True,
        )

        dead: Set[WebSocket] = set()
        for conn, result in zip(snapshot, results):
            if isinstance(result, Exception):
                logger.debug("Dropping dead WebSocket: %r", result)
                dead.add(conn)

        if dead:
            async with self._lock:
                self.active_connections = [
                    c for c in self.active_connections if c not in dead
                ]


manager = ConnectionManager()
