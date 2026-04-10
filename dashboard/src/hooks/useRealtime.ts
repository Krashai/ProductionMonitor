'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

interface UseRealtimeResult {
  status: RealtimeStatus
  lastEventAt: Date | null
}

const DEBOUNCE_MS = 500
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
// Fallback polling: safety net na wypadek, gdyby SSE wyglądało na żywe,
// ale w rzeczywistości nie dostarczało eventów (np. zgubione broadcasty,
// problemy po stronie EventEmitter). unstable_cache i tak buforuje zapytania.
const FALLBACK_POLL_MS = 60000

/**
 * Subskrybuje strumień SSE z /api/events.
 *
 * Niezawodność:
 * - Automatyczny reconnect z exponential backoff (1s → 30s).
 * - Trailing-edge debounce zamiast leading throttle, żeby nie gubić zdarzeń.
 * - Ekspozycja stanu połączenia dla wskaźnika w UI.
 * - Po każdym udanym (re)connect wymuszamy router.refresh() — reconciliacja danych.
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

  const scheduleRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      router.refresh()
    }, DEBOUNCE_MS)
  }, [router])

  useEffect(() => {
    isMountedRef.current = true

    // Fallback polling — niezależne od stanu SSE. Działa jako safety net
    // gdyby kanał był "żywy" (OPEN) ale nie dostarczał eventów.
    fallbackPollRef.current = setInterval(() => {
      if (!isMountedRef.current) return
      router.refresh()
    }, FALLBACK_POLL_MS)

    const connect = () => {
      if (!isMountedRef.current) return

      setStatus((prev) => (prev === 'connected' ? prev : 'connecting'))

      const es = new EventSource('/api/events')
      esRef.current = es

      es.onopen = () => {
        backoffRef.current = INITIAL_BACKOFF_MS
        setStatus('connected')
        // Rekonsyliacja: na (re)connect wymuszamy świeży stan z serwera.
        scheduleRefresh()
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastEventAt(new Date())

          if (data.type === 'CONNECTED') {
            // pakiet powitalny — stan już ustawiony w onopen
            return
          }
          if (data.type === 'PING') {
            // heartbeat z serwera, ignorujemy na poziomie biznesowym
            return
          }

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

    connect()

    return () => {
      isMountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (fallbackPollRef.current) clearInterval(fallbackPollRef.current)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [scheduleRefresh, router])

  return { status, lastEventAt }
}
