/**
 * Czysta logika wyboru wizualnego stanu kafelka linii.
 *
 * Wyizolowana z `LineCard`, żeby dało się ją w pełni przetestować bez Reacta
 * i bez bazy. Komponent dostaje gotowy wariant i tylko mapuje go na klasy.
 *
 * Priorytety:
 *   1. offline — brak połączenia bije wszystko inne.
 *   2. tryb pracy (PLAN_MODE / NO_PLAN_MODE) decyduje o reszcie.
 *
 * Status `true` oznacza, że maszyna pracuje (PRACA); `false`/`undefined` to
 * postój/alarm.
 */

import type { AppMode } from '@/lib/settings';
import { MIN_DISPLAY_SPEED } from '@/lib/speed';

export type LineVisualVariant =
  | 'offline'
  | 'plan-working'
  | 'plan-alarm'
  | 'plan-idle'
  | 'no-plan-running'
  | 'no-plan-stopped';

export interface LineVisualState {
  variant: LineVisualVariant;
}

export interface DeriveLineVisualStateParams {
  mode: AppMode;
  isOffline: boolean;
  hasActivePlan: boolean;
  /** Aktualny status z ostatniej próbki: true = PRACA. */
  status: boolean | undefined;
  /** Aktualna prędkość w m/min. */
  speed: number;
}

export function deriveLineVisualState(
  params: DeriveLineVisualStateParams
): LineVisualState {
  const { mode, isOffline, hasActivePlan, status, speed } = params;

  // Priorytet 1: brak połączenia bije wszystko.
  if (isOffline) return { variant: 'offline' };

  if (mode === 'NO_PLAN_MODE') {
    // Spójnie z progiem wyświetlania: poniżej MIN_DISPLAY_SPEED pokazujemy 0.0,
    // więc kafelek nie może być wtedy zielony (NaN też daje false).
    const isRunning = status === true && speed >= MIN_DISPLAY_SPEED;
    return { variant: isRunning ? 'no-plan-running' : 'no-plan-stopped' };
  }

  // PLAN_MODE
  if (!hasActivePlan) return { variant: 'plan-idle' };
  return { variant: status === true ? 'plan-working' : 'plan-alarm' };
}
