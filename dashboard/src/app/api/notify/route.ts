import { emitRealtimeEvent, type RealtimeEvent } from '@/lib/events'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'crypto'

const ALLOWED_TYPES: ReadonlyArray<RealtimeEvent['type']> = [
  'LINE_UPDATE',
  'PLAN_UPDATE',
  'REVALIDATE',
]

const NOTIFY_TOKEN = process.env.NOTIFY_TOKEN

if (!NOTIFY_TOKEN) {
  // Świadoma decyzja: pozwalamy wystartować bez tokenu, ale głośno
  // ostrzegamy. Na produkcji koniecznie ustawić NOTIFY_TOKEN w env.
  console.warn(
    '[notify] NOTIFY_TOKEN is not set — /api/notify will accept any request. Set it in production.',
  )
}

function verifyToken(req: NextRequest): boolean {
  if (!NOTIFY_TOKEN) return true
  const provided = req.headers.get('x-notify-token') ?? ''
  const expected = NOTIFY_TOKEN

  // Constant-time porównanie — długości muszą się zgadzać, inaczej
  // timingSafeEqual rzuca. Wyrównujemy przez Buffer.from na tej samej długości.
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * POST /api/notify
 *
 * Odbiera powiadomienia od gateway i emituje je do klientów SSE.
 *
 * Niezawodność:
 * - Wymaga nagłówka X-Notify-Token zgodnego z env NOTIFY_TOKEN. Bez
 *   tego każdy w sieci wewnętrznej mógł fałszować zdarzenia lub
 *   masowo wywoływać refreshe.
 * - Unieważniamy cache ('halls-data') PRZED wysłaniem eventu. Inaczej
 *   klient dostaje event, wywołuje router.refresh(), a serwer wraca
 *   stare dane z unstable_cache aż do czasu revalidate — wyścig z
 *   widocznym opóźnieniem.
 */
export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
export async function GET(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  revalidateTag('halls-data')
  emitRealtimeEvent({ type: 'REVALIDATE', timestamp: new Date().toISOString() })
  return NextResponse.json({ message: 'Legacy revalidate triggered' })
}
