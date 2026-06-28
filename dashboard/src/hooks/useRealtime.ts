'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

interface UseRealtimeResult {
  status: RealtimeStatus
  /** Ostatni BUSINESS event (LINE_UPDATE/PLAN_UPDATE/REVALIDATE).
   *  Może być null gdy nic się nie zmieniło od chwili otwarcia karty
   *  — to NIE znaczy "awaria", linia może po prostu stabilnie pracować. */
  lastEventAt: Date | null
}

const DEBOUNCE_MS = 500
const MAX_DEBOUNCE_WAIT_MS = 2000
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
// Fallback polling: safety net gdyby SSE wyglądał na żywy ale nie dostarczał eventów.
const FALLBACK_POLL_MS = 15000

/**
 * Subskrybuje strumień SSE z /api/events.
 *
 * Niezawodność:
 * - Automatyczny reconnect z exponential backoff (1s → 30s).
 * - Trailing-edge debounce z maxWait(2s) — ciągły stream eventów nie blokuje
 *   router.refresh() bezterminowo.
 * - Po każdym (re)connect router.refresh() — reconciliacja danych.
 * - visibilitychange + online: wymuś reconnect+refresh gdy karta wraca z tła
 *   (resume PC, switch tab, sieć wraca). Bez tego browser może trzymać "OPEN"
 *   socket bez dostawy eventów i operator widzi stale.
 * - useEffect ma puste deps [] — routerRef trzyma aktualną referencję do routera
 *   bez restartu effectu (i zamykania/otwierania SSE) przy każdej zmianie
 *   referencji routera po router.refresh().
 */
export function useRealtimeUpdates(): UseRealtimeResult {
  const router = useRouter()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const isMountedRef = useRef(true)
  const routerRef = useRef(router)
  const lastScheduledRef = useRef<number>(0)

  // Aktualizuj routerRef przy każdym renderze bez restartu głównego effectu
  useEffect(() => {
    routerRef.current = router
  })

  useEffect(() => {
    isMountedRef.current = true

    const scheduleRefresh = () => {
      const now = Date.now()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      const timeSinceLast = now - lastScheduledRef.current
      const delay = timeSinceLast > MAX_DEBOUNCE_WAIT_MS ? 0 : DEBOUNCE_MS
      lastScheduledRef.current = now
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        routerRef.current.refresh()
      }, delay)
    }

    const connect = () => {
      if (!isMountedRef.current) return

      setStatus((prev) => (prev === 'connected' ? prev : 'connecting'))

      const es = new EventSource('/api/events')
      esRef.current = es

      es.onopen = () => {
        backoffRef.current = INITIAL_BACKOFF_MS
        setStatus('connected')
        scheduleRefresh()
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'CONNECTED') return
          if (data.type === 'PING') return

          // Tylko BUSINESS event aktualizuje lastEventAt — tooltip "ostatnia
          // aktualizacja" pokazuje faktyczne zmiany, nie heartbeaty.
          setLastEventAt(new Date())
          scheduleRefresh()
        } catch (err) {
          console.error('SSE parse error:', err)
        }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (!isMountedRef.current) return
        setStatus('disconnected')

        const delay = backoffRef.current
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          connect()
        }, delay)
      }
    }

    const forceReconnect = () => {
      if (!isMountedRef.current) return
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      backoffRef.current = INITIAL_BACKOFF_MS
      if (esRef.current) {
        try { esRef.current.close() } catch { /* noop */ }
        esRef.current = null
      }
      connect()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceReconnect()
    }
    const onOnline = () => forceReconnect()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    fallbackPollRef.current = setInterval(() => {
      if (!isMountedRef.current) return
      routerRef.current.refresh()
    }, FALLBACK_POLL_MS)

    connect()

    return () => {
      isMountedRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (fallbackPollRef.current) clearInterval(fallbackPollRef.current)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [])

  return { status, lastEventAt }
}
