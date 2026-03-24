'use client'

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook useRealtimeUpdates
 * Subskrybuje strumień SSE z serwera i odświeża dane przy każdej zmianie
 */
export function useRealtimeUpdates() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Zapobiegamy wielokrotnemu nawiązywaniu połączenia
    if (eventSourceRef.current) return;

    console.log('📡 Connecting to Real-time updates...');
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    let lastRefresh = 0;
    const REFRESH_THRESHOLD = 2000; // max raz na 2 sekundy

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'CONNECTED') {
          console.log('✅ Real-time connected');
          return;
        }

        const now = Date.now();
        if (now - lastRefresh < REFRESH_THRESHOLD) {
          return;
        }

        console.log(`🔔 Update received: ${data.type}`, data.lineId || '');
        
        lastRefresh = now;
        router.refresh();
      } catch (err) {
        console.error('❌ Error parsing SSE message:', err);
      }
    };

    es.onerror = (err) => {
      console.error('⚠️ SSE Connection error. Attempting to reconnect...');
      es.close();
      eventSourceRef.current = null;
    };

    // Cleanup przy odmontowaniu komponentu
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [router]);
}
