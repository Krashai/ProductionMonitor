import { eventEmitter } from '@/lib/events';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint GET /api/events
 * Utrzymuje połączenie SSE z przeglądarką
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let onDataUpdate: (event: unknown) => void;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      onDataUpdate = (event: unknown) => sendEvent(event);
      eventEmitter.on('data-update', onDataUpdate);

      sendEvent({ type: 'CONNECTED', timestamp: new Date().toISOString() });

      // Heartbeat co 25s — SSE comment (`:`) resetuje proxy_read_timeout
      // bez wyzwalania onmessage w przegladarce.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        eventEmitter.off('data-update', onDataUpdate);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      clearInterval(heartbeat);
      eventEmitter.off('data-update', onDataUpdate);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
