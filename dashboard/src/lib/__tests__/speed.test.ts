import { describe, expect, test } from 'vitest';
import { displaySpeed, MIN_DISPLAY_SPEED } from '@/lib/speed';

describe('MIN_DISPLAY_SPEED', () => {
  test('próg wyświetlania to 1 m/min', () => {
    expect(MIN_DISPLAY_SPEED).toBe(1);
  });
});

describe('displaySpeed', () => {
  test('brak wartości (null/undefined) => 0', () => {
    expect(displaySpeed(null)).toBe(0);
    expect(displaySpeed(undefined)).toBe(0);
  });

  test('wartości nieskończone i NaN => 0', () => {
    expect(displaySpeed(NaN)).toBe(0);
    expect(displaySpeed(Infinity)).toBe(0);
    expect(displaySpeed(-Infinity)).toBe(0);
  });

  test('wartości ujemne nigdy nie są pokazywane => 0', () => {
    expect(displaySpeed(-0.1)).toBe(0);
    expect(displaySpeed(-5)).toBe(0);
    expect(displaySpeed(-1000)).toBe(0);
  });

  test('ujemne zero => dokładnie 0 (nie -0)', () => {
    expect(displaySpeed(-0)).toBe(0);
  });

  test('wartości poniżej 1 m/min (szum) => 0', () => {
    expect(displaySpeed(0)).toBe(0);
    expect(displaySpeed(0.2)).toBe(0);
    expect(displaySpeed(0.5)).toBe(0);
    expect(displaySpeed(0.99)).toBe(0);
  });

  test('dokładnie 1.0 jest pokazywane jako 1', () => {
    expect(displaySpeed(1)).toBe(1);
    expect(displaySpeed(1.0)).toBe(1);
  });

  test('wartości od 1 wzwyż przechodzą bez zmian', () => {
    expect(displaySpeed(1.04)).toBe(1.04);
    expect(displaySpeed(12.5)).toBe(12.5);
    expect(displaySpeed(250)).toBe(250);
  });

  test('wartość jako string jest parsowana (typ z historii LineDiagnostics)', () => {
    expect(displaySpeed('12.5')).toBe(12.5);
    expect(displaySpeed('1')).toBe(1);
    expect(displaySpeed('0.2')).toBe(0);
    expect(displaySpeed('-0.1')).toBe(0);
  });

  test('nieparsowalny string / pusty string => 0', () => {
    expect(displaySpeed('abc')).toBe(0);
    expect(displaySpeed('')).toBe(0);
    expect(displaySpeed('  ')).toBe(0);
    expect(displaySpeed('NaN')).toBe(0);
  });
});
