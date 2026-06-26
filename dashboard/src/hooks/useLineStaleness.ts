'use client';

import { useEffect, useState } from 'react';

// 30s ciszy z gateway → linia offline. Worker heartbeat co 10s → 3 stracone.
const STALE_THRESHOLD_MS = 30_000;

export function useLineStaleness(lastSeenAt: string | null): boolean {
  // Inicjalizacja po stronie klienta żeby uniknąć hydration mismatch:
  // serwer zawsze renderuje false, klient liczy od razu z Date.now().
  const [isStale, setIsStale] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ms = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    return !ms || Date.now() - ms > STALE_THRESHOLD_MS;
  });

  useEffect(() => {
    const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const check = () => {
      setIsStale(!lastSeenMs || Date.now() - lastSeenMs > STALE_THRESHOLD_MS);
    };
    check();
    const interval = setInterval(check, 5_000);
    return () => clearInterval(interval);
  }, [lastSeenAt]);

  return isStale;
}
