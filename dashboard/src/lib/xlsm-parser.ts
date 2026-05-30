/**
 * Parser pliku XLSM/XLSX dla harmonogramu produkcji.
 * Działa po stronie klienta (SheetJS).
 */

import type { WorkBook } from 'xlsx';
import type { ImportLine, ImportRow, ParsedRow } from './import-types';

const SHEET_NAME = 'Gantt_dane';
const HEADER_ROW = 1; // wiersz 1 to nagłówek — dane zaczynają się od wiersza 2

/**
 * Transformuje identyfikator zasobu z pliku na plcId z bazy danych.
 *
 * Reguły:
 *  - "Ex" prefix → "LP" prefix  (np. Ex205 → LP205)
 *  - Czyste cyfry  → prefix "LCE"  (np. 131 → LCE131)
 *  - Pozostałe     → bez zmian  (np. INS1 → INS1)
 */
export function transformResourceToPlcId(resource: string): string {
  const trimmed = resource.trim();

  if (trimmed.startsWith('Ex')) {
    return 'LP' + trimmed.slice(2);
  }

  if (/^\d+$/.test(trimmed)) {
    return 'LCE' + trimmed;
  }

  return trimmed;
}

/**
 * Parsuje sheet "Gantt_dane" i zwraca surowe wiersze.
 * Używa kolumn: A (zasób), B (indeks), E (datetime start), H (datetime end).
 * Kolor (J) i czas trwania (I) są ignorowane zgodnie z wymaganiami.
 */
export function parseGanttSheet(workbook: WorkBook): ParsedRow[] {
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new Error(
      `Nie znaleziono arkusza "${SHEET_NAME}" w pliku. Upewnij się, że importujesz właściwy plik.`
    );
  }

  // Dynamiczny import — xlsx jest lazy-loaded po stronie klienta
  const XLSX = require('xlsx') as typeof import('xlsx');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];

  const parsed: ParsedRow[] = [];

  for (let i = HEADER_ROW; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    const resource = String(row[0] ?? '').trim();
    const productIndex = String(row[1] ?? '').trim();
    // Kolumna E (indeks 4) — datetime start; kolumna H (indeks 7) — datetime end
    const rawStart = row[4];
    const rawEnd = row[7];

    if (!resource || !productIndex) continue;
    if (!rawStart || !rawEnd) continue;

    const startTime = parseXlsxDate(rawStart);
    const endTime = parseXlsxDate(rawEnd);

    if (!startTime || !endTime) continue;
    if (endTime <= startTime) continue;

    parsed.push({
      resource,
      plcId: transformResourceToPlcId(resource),
      productIndex,
      startTime,
      endTime,
    });
  }

  return parsed;
}

/**
 * Konwertuje wartość daty z SheetJS na obiekt Date.
 * SheetJS może zwrócić: Date, number (serial Excel), string.
 */
function parseXlsxDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    return new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S);
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Łączy sparsowane wiersze z liniami z bazy (po plcId).
 * Zwraca znane wiersze (z rozwiązanym lineId) i listę nierozpoznanych zasobów.
 */
export function resolveRows(
  rows: ParsedRow[],
  lines: ImportLine[]
): { known: ImportRow[]; unknown: string[] } {
  const lineMap = new Map<string, ImportLine>(lines.map((l) => [l.plcId, l]));
  const unknownSet = new Set<string>();
  let idCounter = 0;

  const known: ImportRow[] = [];

  for (const row of rows) {
    const line = lineMap.get(row.plcId);

    if (!line) {
      unknownSet.add(row.resource);
      continue;
    }

    known.push({
      id: `import-${idCounter++}`,
      lineId: line.id,
      lineName: `${line.hallName} — ${line.name}`,
      resource: row.resource,
      productIndex: row.productIndex,
      startTime: row.startTime,
      endTime: row.endTime,
      plannedSpeed: 0,
    });
  }

  return { known, unknown: Array.from(unknownSet) };
}
