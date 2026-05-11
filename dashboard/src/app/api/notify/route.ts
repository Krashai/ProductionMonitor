import { emitRealtimeEvent } from '@/lib/events';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint POST /api/notify
 * Odbiera powiadomienia od Gatewaya i emituje je do wszystkich klientów SSE
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Walidacja zdarzenia
    const { type, lineId } = body;
    
    if (!type) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    revalidateTag('halls-data');
    emitRealtimeEvent({
      type,
      lineId,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Kompatybilność wsteczna dla starego mechanizmu revalidate
 */
export async function GET(req: NextRequest) {
  revalidateTag('halls-data');
  emitRealtimeEvent({ type: 'REVALIDATE', timestamp: new Date().toISOString() });
  return NextResponse.json({ message: 'Legacy revalidate triggered' });
}
