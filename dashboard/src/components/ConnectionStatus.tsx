'use client'

import { cn } from '@/lib/utils'
import { Radio, WifiOff, Loader2 } from 'lucide-react'
import type { RealtimeStatus } from '@/hooks/useRealtime'

interface Props {
  status: RealtimeStatus
  lastEventAt: Date | null
  className?: string
}

/**
 * Wskaźnik stanu kanału real-time.
 * W monitoringu produkcji operator MUSI od razu widzieć, czy patrzy
 * na żywe dane, czy na zdjęcie sprzed X minut.
 */
export function ConnectionStatus({ status, lastEventAt, className }: Props) {
  const label =
    status === 'connected' ? 'LIVE' : status === 'connecting' ? 'ŁĄCZENIE' : 'OFFLINE'

  const Icon =
    status === 'connected' ? Radio : status === 'connecting' ? Loader2 : WifiOff

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors',
        status === 'connected' && 'bg-emerald-50 border-emerald-100 text-emerald-700',
        status === 'connecting' && 'bg-amber-50 border-amber-100 text-amber-700',
        status === 'disconnected' && 'bg-rose-50 border-rose-100 text-rose-700',
        className,
      )}
      title={
        lastEventAt
          ? `Ostatnia aktualizacja: ${lastEventAt.toLocaleTimeString('pl-PL')}`
          : 'Brak aktualizacji w tej sesji'
      }
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
