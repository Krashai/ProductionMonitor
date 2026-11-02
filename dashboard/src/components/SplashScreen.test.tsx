import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SplashScreen, SPLASH_FALLBACK_MS } from './SplashScreen';

describe('SplashScreen', () => {
  it('renderuje hasło po stronie serwera, dzięki czemu jest widoczne przed hydratacją', () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<SplashScreen />);

    // Assert
    expect(html).toContain('Walk to the');
    expect(html).toContain('>red</span>');
  });

  it('jest dekoracyjny: ukryty dla czytników ekranu', () => {
    const html = renderToStaticMarkup(<SplashScreen />);

    expect(html).toContain('aria-hidden="true"');
  });

  it('awaryjny timeout jest dłuższy niż cała animacja (~2,35 s)', () => {
    expect(SPLASH_FALLBACK_MS).toBeGreaterThan(2350);
  });
});
