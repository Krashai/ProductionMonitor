import { useEffect } from 'react';
import type { PLC } from '../api';

const WS_URL = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_WS_URL || `ws://${window.location.hostname}:8000/ws`;

export const usePLCWebsocket = (onUpdate: (data: PLC) => void) => {
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PLC_UPDATE') {
            onUpdate(data.payload);
          }
        } catch (e) {
          console.error("Błąd parsowania WS:", e);
        }
      };

      ws.onclose = () => {
        console.log("Połączenie WS zamknięte, ponawiam za 3s...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("Błąd WebSocket:", err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [onUpdate]);
};
