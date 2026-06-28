import { EventEmitter } from 'events';

// Rozszerzamy typ globalny, aby zachować instancję podczas Hot Reload w Next.js
const globalForEvents = global as unknown as {
  eventEmitter: EventEmitter;
};

// Singleton EventEmittera, który przetrwa odświeżanie kodu w trybie dev
/**
 * WAŻNE: Ten EventEmitter działa tylko w środowisku single-process Node.js.
 * W trybie multi-process (PM2 cluster, multiple Docker replicas) każdy proces
 * ma własną instancję — POST /api/notify i GET /api/events mogą trafić do
 * różnych procesów, co sprawi że eventy nie dotrą do klientów SSE.
 * Deployment tego serwera MUSI być single-process (jeden worker Node.js).
 */
export const eventEmitter = globalForEvents.eventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventEmitter = eventEmitter;
}

/**
 * Typy zdarzeń przesyłanych w systemie
 */
export type RealtimeEvent = {
  type: 'LINE_UPDATE' | 'PLAN_UPDATE' | 'REVALIDATE';
  lineId?: string;
  timestamp: string;
};

/**
 * Funkcja do emitowania zdarzeń do wszystkich połączonych klientów SSE
 */
export function emitRealtimeEvent(event: RealtimeEvent) {
  eventEmitter.emit('data-update', event);
}
