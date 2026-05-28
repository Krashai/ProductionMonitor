'use client'

import { cn } from '@/lib/utils'
import { Radio, WifiOff, Loader2 } from 'lucide-react'
import type { RealtimeStatus } from '@/hooks/useRealtime'

interface Props {
  status: RealtimeStatus
  /** Ostatni BUSINESS event. null = brak zmian od mount — to nie awaria. */
  lastEventAt: Date | null
  className?: string
}

/**
 * Wskaźnik stanu kanału real-time.
 *
 * Tooltip rozróżnia dwie sytuacje, które wcześniej wyglądały tak samo:
 * - connected + lastEventAt null → "LIVE, bez zmian" (zdrowy idle)
 * - connected + lastEventAt stary → "LIVE, ostatnia zmiana o HH:MM"
 * Bez tego operator widział "Ostatnia aktualizacja: 11:43" i myślał, że
 * coś nie działa, choć linia po prostu stabilnie pracowała.
 */
export function ConnectionStatus({ status, lastEventAt, className }: Props) {
  const label =
    status === 'connected' ? 'LIVE' : status === 'connecting' ? 'ŁĄCZENIE' : 'OFFLINE'

  const Icon =
    status === 'connected' ? Radio : status === 'connecting' ? Loader2 : WifiOff

  const titleText = (() => {
    if (status === 'disconnected') return 'Brak połączenia z serwerem. Próba wznowienia w toku.'
    if (status === 'connecting') return 'Łączenie z serwerem realtime...'
    if (!lastEventAt) return 'LIVE — brak zmian od otwarcia karty (linia stabilna).'
    return `LIVE — ostatnia zmiana: ${lastEventAt.toLocaleTimeString('pl-PL')}`
  })()

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors',
        status === 'connected' && 'bg-emerald-50 border-emerald-100 text-emerald-700',
        status === 'connecting' && 'bg-amber-50 border-amber-100 text-amber-700',
        status === 'disconnected' && 'bg-rose-50 border-rose-100 text-rose-700',
        className,
      )}
      title={titleText}
    >
      <Icon
        size={12}
        className={cn(
          status === 'connected' && 'animate-pulse',
          status === 'connecting' && 'animate-spin',
        )}
      />
      <span>{label}</span>
    </div>
  )
}
