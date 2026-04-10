import { emitRealtimeEvent, type RealtimeEvent } from '@/lib/events'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

const ALLOWED_TYPES: ReadonlyArray<RealtimeEvent['type']> = [
  'LINE_UPDATE',
  'PLAN_UPDATE',
  'REVALIDATE',
]

/**
 * POST /api/notify
 *
 * Odbiera powiadomienia od gateway i emituje je do klientów SSE.
 *
 * Niezawodność:
 * - Unieważniamy cache ('halls-data') PRZED wysłaniem eventu. Inaczej
 *   klient dostaje event, wywołuje router.refresh(), a serwer wraca
 *   stare dane z unstable_cache aż do czasu revalidate — wyścig z
 *   widocznym opóźnieniem.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, lineId } = body as { type?: string; lineId?: string }

    if (!type || !ALLOWED_TYPES.includes(type as RealtimeEvent['type'])) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    // Najpierw unieważnienie cache, potem broadcast — kolejność istotna.
    revalidateTag('halls-data')

    emitRealtimeEvent({
      type: type as RealtimeEvent['type'],
      lineId,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notify Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Legacy: GET revalidate trigger.
 */
export async function GET() {
  revalidateTag('halls-data')
  emitRealtimeEvent({ type: 'REVALIDATE', timestamp: new Date().toISOString() })
  return NextResponse.json({ message: 'Legacy revalidate triggered' })
}
