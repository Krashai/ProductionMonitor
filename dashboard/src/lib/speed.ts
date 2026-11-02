/**
 * Reguła wyświetlania prędkości linii (m/min).
 *
 * Prędkość nie może być ujemna, a szum czujnika (np. 0.2 m/min) nie powinien
 * być pokazywany jako ruch. Dlatego wartość poniżej progu wyświetlamy jako 0.
 *
 * To reguła WYŚWIETLANIA — w bazie zostają surowe wartości dodatnie z PLC
 * (gateway tylko obcina wartości ujemne do 0).
 */

/** Najmniejsza prędkość (m/min), od której pokazujemy wartość dodatnią. */
export const MIN_DISPLAY_SPEED = 1;

/**
 * Zwraca prędkość do pokazania/użycia jako „aktualna”.
 *
 * 0 dla null/undefined/NaN/nieskończoności, wartości ujemnych i wartości
 * poniżej MIN_DISPLAY_SPEED; w przeciwnym razie surowa wartość.
 * Przyjmuje number lub string (historia z bazy bywa zwracana jako string).
 */
export function displaySpeed(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;

  // Number('') i Number('  ') dają 0 — wynik i tak jest 0, więc bez specjalnej obsługi.
  const value = typeof raw === 'number' ? raw : Number(raw);

  if (!Number.isFinite(value) || value < MIN_DISPLAY_SPEED) return 0;
  return value;
}
