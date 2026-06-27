'use client';

import { useRef, useState, useLayoutEffect, useCallback } from 'react';

export function useHallGridRows(lineCounts: number[]) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [templateRows, setTemplateRows] = useState<string>(
    () => lineCounts.map(() => '1fr').join(' ')
  );

  const recalc = useCallback(() => {
    if (!outerRef.current) return;
    const grids = outerRef.current.querySelectorAll<HTMLElement>('[data-hall-grid]');
    if (grids.length !== lineCounts.length) return;

    const rows = Array.from(grids).map((grid, i) => {
      const colStr = getComputedStyle(grid).gridTemplateColumns;
      const cols =
        colStr && colStr !== 'none'
          ? colStr.trim().split(/\s+/).length
          : 1;
      return Math.max(1, Math.ceil(lineCounts[i] / cols));
    });

    const next = rows.map(r => `${r}fr`).join(' ');
    setTemplateRows(prev => (prev === next ? prev : next));
  }, [lineCounts]);

  useLayoutEffect(() => {
    recalc();
    const observer = new ResizeObserver(recalc);
    const el = outerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [recalc]);

  return { outerRef, templateRows };
}
