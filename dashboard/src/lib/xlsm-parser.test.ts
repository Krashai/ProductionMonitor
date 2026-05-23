/**
 * Testy jednostkowe dla xlsm-parser.ts.
 * Uruchom: npm test
 */

import { describe, test, expect } from 'vitest';
import { transformResourceToPlcId, resolveRows } from './xlsm-parser';
import type { ImportLine, ParsedRow } from './import-types';

// ─── transformResourceToPlcId ────────────────────────────────────────────────

describe('transformResourceToPlcId', () => {
  describe('Ex prefix → LP prefix', () => {
    test('Ex205 → LP205', () => {
      expect(transformResourceToPlcId('Ex205')).toBe('LP205');
    });

    test('Ex505 → LP505', () => {
      expect(transformResourceToPlcId('Ex505')).toBe('LP505');
    });

    test('Ex707 → LP707', () => {
      expect(transformResourceToPlcId('Ex707')).toBe('LP707');
    });

    test('Ex1000 → LP1000', () => {
      expect(transformResourceToPlcId('Ex1000')).toBe('LP1000');
    });
  });

  describe('Czyste cyfry → LCE prefix', () => {
    test('131 → LCE131', () => {
      expect(transformResourceToPlcId('131')).toBe('LCE131');
    });

    test('132 → LCE132', () => {
      expect(transformResourceToPlcId('132')).toBe('LCE132');
    });

    test('999 → LCE999', () => {
      expect(transformResourceToPlcId('999')).toBe('LCE999');
    });
  });

  describe('Bez zmian (INS i inne)', () => {
    test('INS1 → INS1', () => {
      expect(transformResourceToPlcId('INS1')).toBe('INS1');
    });

    test('INS2 → INS2', () => {
      expect(transformResourceToPlcId('INS2')).toBe('INS2');
    });

    test('LP205 → LP205 (już prawidłowy)', () => {
      expect(transformResourceToPlcId('LP205')).toBe('LP205');
    });
  });

  describe('Białe znaki', () => {
    test('  Ex205  → LP205 (trim)', () => {
      expect(transformResourceToPlcId('  Ex205  ')).toBe('LP205');
    });

    test('  131  → LCE131 (trim)', () => {
      expect(transformResourceToPlcId('  131  ')).toBe('LCE131');
    });
  });
});

// ─── resolveRows ─────────────────────────────────────────────────────────────

const mockLines: ImportLine[] = [
  { id: 'line-1', plcId: 'LP205', name: 'Linia 205', hallName: 'Hala A' },
  { id: 'line-2', plcId: 'LP505', name: 'Linia 505', hallName: 'Hala A' },
  { id: 'line-3', plcId: 'LCE131', name: 'Linia 131', hallName: 'Hala B' },
  { id: 'line-4', plcId: 'INS1', name: 'Inspekcja 1', hallName: 'Hala B' },
];

const makeRow = (resource: string): ParsedRow => ({
  resource,
  plcId: transformResourceToPlcId(resource),
  productIndex: 'TEST001',
  startTime: new Date('2026-05-18T16:00:00'),
  endTime: new Date('2026-05-19T08:00:00'),
});

describe('resolveRows', () => {
  test('zwraca znane wiersze z prawidłowym lineId', () => {
    const rows = [makeRow('Ex205'), makeRow('Ex505')];
    const { known } = resolveRows(rows, mockLines);

    expect(known).toHaveLength(2);
    expect(known[0].lineId).toBe('line-1');
    expect(known[0].lineName).toBe('Hala A — Linia 205');
    expect(known[1].lineId).toBe('line-2');
  });

  test('zwraca nieznane zasoby osobno', () => {
    const rows = [makeRow('Ex999'), makeRow('Ex205')];
    const { known, unknown } = resolveRows(rows, mockLines);

    expect(known).toHaveLength(1);
    expect(unknown).toContain('Ex999');
    expect(unknown).not.toContain('Ex205');
  });

  test('obsługuje zasoby numeryczne (131)', () => {
    const rows = [makeRow('131')];
    const { known, unknown } = resolveRows(rows, mockLines);

    expect(known).toHaveLength(1);
    expect(known[0].lineId).toBe('line-3');
    expect(unknown).toHaveLength(0);
  });

  test('obsługuje INS1 bez transformacji', () => {
    const rows = [makeRow('INS1')];
    const { known } = resolveRows(rows, mockLines);

    expect(known).toHaveLength(1);
    expect(known[0].lineId).toBe('line-4');
  });

  test('domyślna prędkość = 0', () => {
    const rows = [makeRow('Ex205')];
    const { known } = resolveRows(rows, mockLines);

    expect(known[0].plannedSpeed).toBe(0);
  });

  test('puste linie → wszystkie nieznane', () => {
    const rows = [makeRow('Ex205')];
    const { known, unknown } = resolveRows(rows, []);

    expect(known).toHaveLength(0);
    expect(unknown).toContain('Ex205');
  });

  test('puste wiersze → puste wyniki', () => {
    const { known, unknown } = resolveRows([], mockLines);

    expect(known).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });

  test('nie duplikuje nieznanych zasobów', () => {
    const rows = [makeRow('Ex999'), makeRow('Ex999'), makeRow('Ex999')];
    const { unknown } = resolveRows(rows, mockLines);

    expect(unknown.filter((u) => u === 'Ex999')).toHaveLength(1);
  });
});
