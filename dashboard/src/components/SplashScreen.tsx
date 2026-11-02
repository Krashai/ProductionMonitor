'use client';

import { useEffect, useState } from 'react';
import type { AnimationEvent } from 'react';
import styles from './SplashScreen.module.css';

/**
 * Awaryjny czas (ms) po którym nakładka jest zdejmowana, gdyby zdarzenie animationend
 * nie nadeszło. Musi być dłuższy niż cała animacja z SplashScreen.module.css (~2,35 s).
 */
export const SPLASH_FALLBACK_MS = 3500;

/**
 * Ekran powitalny "Walk to the red" — pokazuje się tylko przy pełnym załadowaniu dokumentu
 * (wpisanie adresu / odświeżenie). Renderowany z root layoutu, który nie jest montowany
 * ponownie przy nawigacji klienckiej, więc po zmianie trasy nie wraca.
 *
 * Animacja jest w całości w CSS (rusza przed hydratacją); stan służy wyłącznie do
 * odmontowania nakładki po jej zakończeniu.
 */
export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  // Zabezpieczenie na wypadek, gdyby animationend nie wystąpiło
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), SPLASH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  // Zdarzenia animacji dzieci też bąbelkują — reagujemy tylko na animację samej nakładki (zanik)
  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setIsVisible(false);
  };

  return (
    // Element czysto dekoracyjny: ukryty dla czytników ekranu, bez fokusowalnych dzieci
    <div className={styles.splash} aria-hidden='true' onAnimationEnd={handleAnimationEnd}>
      <p className={styles.slogan}>
        Walk to the <span className={styles.red}>red</span>
      </p>
    </div>
  );
}
