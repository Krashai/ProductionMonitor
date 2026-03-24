import { EventEmitter } from 'events';

// Rozszerzamy typ globalny, aby zachować instancję podczas Hot Reload w Next.js
const globalForEvents = global as unknown as {
  eventEmitter: EventEmitter;
};

// Singleton EventEmittera, który przetrwa odświeżanie kodu w trybie dev
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
