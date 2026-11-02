// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logo } from '@/components/brand/Logo';
import { LINEON_LOGO } from '@/components/brand/lineon-logo.generated';

// Granice losowego odstępu do mrugnięcia i czas mrugnięcia (Logo.tsx).
const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 180_000;
const WINK_DURATION_MS = 1_600;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // vitest.config.ts nie ustawia `globals: true`, więc auto-cleanup z
  // @testing-library/react się nie rejestruje — bez tego DOM z jednego testu
  // przeciekałby do kolejnego.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Spy na Math.random nie jest czyszczony przez unstubAllGlobals — bez tego
  // przeciekałby do kolejnych testów.
  vi.restoreAllMocks();
});

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));
}

describe('Logo', () => {
  test('renderuje wordmark jako obraz z nazwą dostępną "LineON"', () => {
    render(<Logo />);
    const logo = screen.getByRole('img', { name: 'LineON' });
    expect(logo.getAttribute('data-product')).toBe('lineon');
    expect(logo.getAttribute('data-state')).toBe('brand');
    expect(logo.querySelector('.ln-glyphs')).not.toBeNull();
    expect(logo.querySelector('.ln-bezel')).not.toBeNull();
    expect(logo.querySelector('.ln-lens')).not.toBeNull();
  });

  test('klasa wysokości z propsa trafia na SVG obok klas bazowych', () => {
    render(<Logo className="h-5 xl:h-6" />);
    const classes = screen.getByRole('img').getAttribute('class') ?? '';
    expect(classes).toContain('ln-logo');
    expect(classes).toContain('h-5');
    expect(classes).toContain('xl:h-6');
  });

  test('własny label nadpisuje domyślną nazwę dostępną', () => {
    render(<Logo label="Strona główna" />);
    expect(screen.getByRole('img', { name: 'Strona główna' })).not.toBeNull();
  });

  test('bez propa wink lampka nigdy nie mruga i nie ustawia timerów', () => {
    mockReducedMotion(false);
    render(<Logo />);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(MAX_DELAY_MS * 3));
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(false);
  });

  test('easter egg: nie mruga przed minimalnym odstępem', () => {
    mockReducedMotion(false);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Logo wink />);
    act(() => vi.advanceTimersByTime(MIN_DELAY_MS - 1));
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(true);
  });

  test('easter egg: mruga najpóźniej po maks. odstępie i wraca do koloru marki', () => {
    mockReducedMotion(false);
    vi.spyOn(Math, 'random').mockReturnValue(1);
    render(<Logo wink />);
    const logo = screen.getByRole('img');

    act(() => vi.advanceTimersByTime(MAX_DELAY_MS - 1));
    expect(logo.hasAttribute('data-wink')).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(logo.hasAttribute('data-wink')).toBe(true);
    act(() => vi.advanceTimersByTime(WINK_DURATION_MS));
    expect(logo.hasAttribute('data-wink')).toBe(false);
    // Nazwa dostępna się nie zmienia — mrugnięcie to dekoracja, nie stan.
    expect(screen.getByRole('img', { name: 'LineON' })).toBe(logo);
  });

  test('easter egg się powtarza: koniec pierwszego mrugnięcia, potem drugie', () => {
    mockReducedMotion(false);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Logo wink />);
    const logo = screen.getByRole('img');

    act(() => vi.advanceTimersByTime(MIN_DELAY_MS + WINK_DURATION_MS));
    expect(logo.hasAttribute('data-wink')).toBe(false);
    act(() => vi.advanceTimersByTime(MIN_DELAY_MS));
    expect(logo.hasAttribute('data-wink')).toBe(true);
  });

  test('odmontowanie czyści zaplanowany timer', () => {
    mockReducedMotion(false);
    const { unmount } = render(<Logo wink />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('wyłączenie wink w trakcie mrugnięcia zdejmuje data-wink i zatrzymuje timery', () => {
    mockReducedMotion(false);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { rerender } = render(<Logo wink />);
    act(() => vi.advanceTimersByTime(MIN_DELAY_MS));
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(true);

    rerender(<Logo />);
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('prefers-reduced-motion wyłącza mruganie', () => {
    mockReducedMotion(true);
    render(<Logo wink />);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(MAX_DELAY_MS * 3));
    expect(screen.getByRole('img').hasAttribute('data-wink')).toBe(false);
  });
});

// Repo nie ma CI — ten test pilnuje, że plik SVG i dane komponentu pochodzą
// z tego samego przebiegu `npm run build:logo` (ręczna edycja jednego z nich
// rozjechałaby logo w aplikacji i w pliku do pobrania).
describe('wygenerowane pliki logo', () => {
  const svg = readFileSync(resolve(__dirname, '../../../../public/brand/logo/lineon.svg'), 'utf8');

  test('ścieżka glifów w lineon.svg = ścieżka w komponencie', () => {
    expect(svg.match(/ d="([^"]+)"/)?.[1]).toBe(LINEON_LOGO.glyphs);
    expect(svg).toContain(`viewBox="${LINEON_LOGO.viewBox}"`);
  });

  test('lineon.svg jest ścieżkami (bez <text>) i mieści się w 5 KB', () => {
    expect(svg).not.toMatch(/<text/);
    expect(Buffer.byteLength(svg)).toBeLessThan(5 * 1024);
  });

  // Geometria lampki wg §3 specyfikacji, w jednostkach H = 100 (±1%).
  test('lampka ma wymiary ze specyfikacji i środek 0.5 H nad linią bazową', () => {
    const { lamp } = LINEON_LOGO;
    expect(lamp.bezelRadius).toBeCloseTo(52, 0);
    expect(lamp.bezelStroke).toBeCloseTo(8, 0);
    expect(lamp.lensRadius).toBeCloseTo(38, 0);
    // viewBox ma wysokość 112 = 1.12 H (średnica zewnętrzna obudowy): środek
    // lampki leży w połowie, a linia bazowa 0.5 H niżej.
    expect(lamp.cy).toBeCloseTo(56, 0);
  });
});
