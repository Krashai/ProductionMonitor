'use client'

import { useEffect, useState, type RefObject } from 'react'

const SCALE_EPSILON = 0.002

/**
 * Scale-to-fit dla kiosk/wallboard — gwarantuje brak clippingu.
 *
 * containerRef: element o stałej wysokości (viewport-bound).
 * contentRef:   element renderowany w naturalnych rozmiarach.
 *
 * Zwraca scale <= 1. Nigdy nie powiększa — tylko zmniejsza gdy content
 * jest wyższy niż dostępna przestrzeń.
 *
 * Obserwujemy oba elementy (container + content) bez ryzyka pętli:
 * mierzymy transform który NIE wpływa na layout-box obserwowany przez RO.
 */
export function useFitToViewport(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  deps: unknown[],
): number {
  const [scale, setScale] = useState(1)

  // useEffect (nie useLayoutEffect) — SSR-safe, nie uruchamia się na serwerze.
  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let isMounted = true

    const measure = () => {
      if (!isMounted) return

      // Reset transform PRZED pomiarem — scrollHeight musi odzwierciedlać naturalną
      // wysokość, nie tę skompresowaną po scale(). Width NIE jest resetowany:
      // content ma stały width 100% (brak width-hacka), więc column-count jest
      // identyczny przy pomiarze i przy renderowaniu — brak rozbieżności.
      const prevTransform = content.style.transform
      content.style.transform = 'none'

      const available = container.clientHeight
      const natural = content.scrollHeight

      content.style.transform = prevTransform

      if (natural <= 0 || available <= 0) {
        setScale(1)
        return
      }

      const next = Math.min(available / natural, 1)
      setScale((prev) => (Math.abs(prev - next) > SCALE_EPSILON ? next : prev))
    }

    // rAF: poczekaj na layout po (re)mount zanim zmierzysz.
    const raf = requestAnimationFrame(measure)

    // Obserwujemy container (zmiana rozmiaru okna) ORAZ content (zmiana liczby kart,
    // zmiana wysokości karty online→offline). Transform nie wpływa na layout-box,
    // więc obserwacja contentu nie tworzy pętli RO.
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(content)

    // Re-pomiar po załadowaniu fontów — tylko jeśli jeszcze nie załadowane.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      if (document.fonts.status !== 'loaded') {
        document.fonts.ready.then(() => {
          if (isMounted) measure()
        }).catch(() => {})
      }
    }

    return () => {
      isMounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, contentRef, ...deps])

  return scale
}
