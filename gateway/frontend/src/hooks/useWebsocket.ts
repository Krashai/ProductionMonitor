import { useEffect, useRef, useState } from 'react';
import type { PLC } from '../api';

const WS_URL = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_WS_URL || `ws://${window.location.hostname}:8000/ws`;

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 20000;

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWsResult {
  status: WsStatus;
  lastEventAt: Date | null;
}

/**
 * Subskrybuje kanał WebSocket z gateway backendu i woła onUpdate przy zmianach PLC.
 *
 * Niezawodność:
 * - Exponential backoff reconnect (1s -> 30s), zamiast stałego 3s
 *   który waliłby serwer przy długiej awarii.
 * - Client heartbeat co 20s - wysłanie w dead socket rzuci błąd,
 *   onclose odpala reconnect.
 * - Stabilny uchwyt onUpdate przez ref: zmiana callbacka nie
 *   wyrzuca całego połączenia.
 * - Ekspozycja stanu dla wskaźnika w UI.
 */
export const usePLCWebsocket = (onUpdate: (data: PLC) => void): UseWsResult => {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let mounted = true;

    const clearTimers = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    };

    const connect = () => {
      if (!mounted) return;

      setStatus(prev => (prev === 'connected' ? prev : 'connecting'));

      try {
        ws = new WebSocket(WS_URL);
      } catch (err) {
        console.error('WS constructor failed:', err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (!mounted) { ws?.close(); return; }
        backoff = INITIAL_BACKOFF_MS;
        setStatus('connected');

        heartbeatTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('ping');
            } catch {
              // send na martwym sockecie rzuci - onclose i tak odpali reconnect
            }
          }
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setLastEventAt(new Date());
          if (data.type === 'PLC_UPDATE' && data.payload) {
            onUpdateRef.current(data.payload);
          }
        } catch (e) {
          console.error('Błąd parsowania WS:', e);
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (!mounted) return;
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onerror zawsze poprzedza onclose - reconnect załatwi onclose
        try { ws?.close(); } catch { /* noop */ }
      };
    };

    const scheduleReconnect = () => {
      if (!mounted || reconnectTimer) return;
      const delay = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    connect();

    return () => {
      mounted = false;
      clearTimers();
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.onopen = null;
        try { ws.close(); } catch { /* noop */ }
      }
    };
  }, []);

  return { status, lastEventAt };
};
