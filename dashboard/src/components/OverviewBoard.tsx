'use client'

import { useRef } from "react";
import { LayoutGrid, CalendarPlus, BarChart3, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { LineCard } from "./LineCard";
import { ConnectionStatus } from "./ConnectionStatus";
import { useRealtimeUpdates } from "@/hooks/useRealtime";
import { useFitToViewport } from "@/hooks/useFitToViewport";
import type { AppMode } from "@/lib/settings";
import type { Hall } from "@/lib/types";

interface Props {
  halls: Hall[];
  mode: AppMode;
}

export function OverviewBoard({ halls, mode }: Props) {
  const { status: realtimeStatus, lastEventAt } = useRealtimeUpdates();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activatedHalls = halls?.filter((h) => h.lines.length > 0) ?? [];
  const totalLines = activatedHalls.reduce((sum, h) => sum + h.lines.length, 0);

  // Kolumny siatki hal: 1→1, 2→2, 3→3 (jeden wiersz), 4→2 (2×2), 5-6→3, 7+→3.
  // 3 hale w jednym wierszu zamiast 2+1 — unika sieroty i maksymalizuje szerokość hal.
  const hallCols = activatedHalls.length <= 1 ? 1
    : activatedHalls.length === 3 ? 3
    : activatedHalls.length <= 4 ? 2
    : 3;

  const scale = useFitToViewport(containerRef, contentRef, [totalLines, hallCols]);

  if (activatedHalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
        Brak danych do wyświetlenia. Uruchom seed bazy danych.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-[2400px] mx-auto px-6 2xl:px-10 py-4">
      {/* NAVBAR */}
      <header className="shrink-0 flex items-center justify-between mb-4 2xl:mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-6">
          <h1 className="text-[11px] font-black uppercase tracking-widest text-slate-900">
            Przegląd fabryki
          </h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">
            {totalLines} {totalLines === 1 ? 'linia' : 'linii'}
          </span>
        </div>

        <div className="flex items-center gap-10">
          <ConnectionStatus status={realtimeStatus} lastEventAt={lastEventAt} />

          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
          >
            <LayoutGrid size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Wallboard</span>
          </Link>

          <Link
            href="/planning"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
          >
            <CalendarPlus size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Planowanie</span>
          </Link>

          <Link
            href="/reporting"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
          >
            <BarChart3 size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Raporty</span>
          </Link>

          <Link
            href="/config"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
          >
            <SlidersHorizontal size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Konfiguracja</span>
          </Link>
        </div>
      </header>

      {/* HALE — JS auto-scale (scale-to-fit, gwarantuje brak clippingu).
          containerRef: stała wysokość (flex-1, viewport-bound), klipuje nadmiar.
          contentRef: renderuje hale w NATURALNYCH rozmiarach, a transform: scale()
          zmniejsza całość tak, by zmieściła się bez clippingu przy każdej rozdzielczości.
          Szczegóły: useFitToViewport (ResizeObserver + rAF + fonts.ready). */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden relative"
      >
        <div
          ref={contentRef}
          className="grid gap-4 2xl:gap-6"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            gridTemplateColumns: `repeat(${hallCols}, 1fr)`,
          }}
        >
          {activatedHalls.map((hall) => (
            <div key={hall.id} className="min-w-0 flex flex-col">
              {/* Nagłówek hali */}
              <div className="shrink-0 flex items-center gap-3 mb-2 2xl:mb-3">
                <h2 className="text-xl 2xl:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  {hall.name}
                </h2>
                <div className="h-px flex-1 bg-slate-100 rounded-full" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 tabular-nums">
                  {hall.lines.length} {hall.lines.length === 1 ? 'linia' : 'linii'}
                </span>
              </div>

              {/* Siatka linii: 10rem min → 3+ kolumn per hala przy 1366px, więcej na 4K. */}
              <div
                className="grid gap-2 2xl:gap-3"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(10rem, 100%), 1fr))',
                }}
              >
                {hall.lines.map((line) => (
                  <LineCard key={line.id} line={line} mode={mode} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
