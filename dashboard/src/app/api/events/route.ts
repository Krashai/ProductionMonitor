import { eventEmitter } from '@/lib/events';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint GET /api/events
 * Utrzymuje połączenie SSE z przeglądarką
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Funkcja wysyłająca wiadomość do klienta w formacie SSE
      const sendEvent = (data: any) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (e) {
          console.error('Error enqueuing message:', e);
        }
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
        controller.close();
      });
    },
    cancel() {
      // Dodatkowe czyszczenie przy zamknięciu streamu
      // eventEmitter.off('data-update', onDataUpdate); // onDataUpdate nie jest dostępny tutaj, obsłużone w start
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
