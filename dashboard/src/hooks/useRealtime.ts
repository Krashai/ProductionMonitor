'use client'

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook useRealtimeUpdates
 * Subskrybuje strumień SSE z serwera i odświeża dane przy każdej zmianie
 */
const REFRESH_THRESHOLD = 2_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useRealtimeUpdates() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let lastRefresh = 0;
    let disposed = false;

    function connect() {
      if (disposed || eventSourceRef.current) return;

      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        retriesRef.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECTED') return;

          const now = Date.now();
          if (now - lastRefresh < REFRESH_THRESHOLD) return;

          lastRefresh = now;
          router.refresh();
        } catch {
          // malformed SSE frame
        }
      };

      es.onerror = () => {
        cleanup();
        if (disposed) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** retriesRef.current,
          RECONNECT_MAX_MS,
        );
        retriesRef.current++;
        timerRef.current = setTimeout(connect, delay);
      };
    }

    function cleanup() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    connect();

    return () => {
      disposed = true;
      cleanup();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);
}
