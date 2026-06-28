import { eventEmitter, type RealtimeEvent } from '@/lib/events'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Na ProductionMonitorze może siedzieć kilkanaście-kilkadziesiąt dashboardów
// jednocześnie. Domyślny MaxListeners=10 sypie ostrzeżeniami w logach.
eventEmitter.setMaxListeners(1000)

const HEARTBEAT_INTERVAL_MS = 15000

/**
 * GET /api/events
 * Strumień SSE dla dashboardu.
 *
 * Niezawodność:
 * - Wysyła heartbeat co 15s (komentarz SSE), żeby proxy/nginx nie ubił
 *   bezczynnego połączenia po swoim timeoucie.
 * - Sprząta listener i interval na abort / błąd zapisu.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  let heartbeat: ReturnType<typeof setInterval> | null = null
  let writeWatchdog: ReturnType<typeof setInterval> | null = null
  let onDataUpdate: ((event: RealtimeEvent) => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      let lastWriteMs = Date.now()

      const safeEnqueue = (chunk: string) => {
        try {
          lastWriteMs = Date.now()
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }

      const sendEvent = (data: unknown) => {
        safeEnqueue(`data: ${JSON.stringify(data)}\n\n`)
      }

      onDataUpdate = (event: RealtimeEvent) => {
        sendEvent(event)
      }

      const cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat)
          heartbeat = null
        }
        if (writeWatchdog) {
          clearInterval(writeWatchdog)
          writeWatchdog = null
        }
        if (onDataUpdate) {
          eventEmitter.off('data-update', onDataUpdate)
          onDataUpdate = null
        }
        try {
          controller.close()
        } catch {
          /* noop — stream already closed */
        }
      }

      eventEmitter.on('data-update', onDataUpdate)

      // Pakiet powitalny — pozwala klientowi wiedzieć, że kanał żyje.
      sendEvent({ type: 'CONNECTED', timestamp: new Date().toISOString() })

      // Heartbeat: ping co 15s. Format `: ...\n\n` to komentarz SSE,
      // który trzyma połączenie otwarte bez wyzwalania onmessage.
      heartbeat = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`)
      }, HEARTBEAT_INTERVAL_MS)

      // Write watchdog: wykrywa zombie connections przy NAT timeout / awarii
      // sieci bez TCP RST, gdy req.signal.abort nigdy nie odpali.
      writeWatchdog = setInterval(() => {
        if (Date.now() - lastWriteMs > HEARTBEAT_INTERVAL_MS * 2) {
          cleanup()
        }
      }, HEARTBEAT_INTERVAL_MS)

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Wyłącza buforowanie w nginx (jeśli jest przed aplikacją).
      'X-Accel-Buffering': 'no',
    },
  })
}
