import { eventEmitter } from '@/lib/events';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint GET /api/events
 * Utrzymuje połączenie SSE z przeglądarką
 */
export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Funkcja wysyłająca wiadomość do klienta w formacie SSE
  const sendEvent = (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(message));
  };

  // Subskrybujemy nasz wewnętrzny emiter zdarzeń
  const onDataUpdate = (event: any) => {
    sendEvent(event);
  };

  eventEmitter.on('data-update', onDataUpdate);

  // Wysyłamy wiadomość powitalną (Keep-alive)
  sendEvent({ type: 'CONNECTED', timestamp: new Date().toISOString() });

  // Obsługa zamknięcia połączenia przez przeglądarkę
  req.signal.addEventListener('abort', () => {
    eventEmitter.off('data-update', onDataUpdate);
    writer.close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
