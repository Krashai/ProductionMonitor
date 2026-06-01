'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineCard } from "./LineCard";
import { Play, Pause, CalendarPlus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useRealtimeUpdates } from "@/hooks/useRealtime";
import { ConnectionStatus } from "./ConnectionStatus";

interface Line {
  id: string;
  name: string;
  plcId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  history: { status: boolean; speed: number; time: string }[];
  plans: { id: string; productIndex: string }[];
  _count: { scrap: number };
}

interface Hall {
  id: string;
  name: string;
  lines: Line[];
}

interface Props {
  halls: Hall[];
}

export function MainDashboard({ halls }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  // Aktywujemy subskrypcję zdarzeń Real-time (zamiast pollowania)
  const { status: realtimeStatus, lastEventAt } = useRealtimeUpdates();

  const ROTATION_TIME = 10000;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % (halls?.length || 1));
    setProgress(0);
  }, [halls?.length]);

  useEffect(() => {
    if (!isPlaying || !halls || halls.length === 0) return;

    const interval = setInterval(nextSlide, ROTATION_TIME);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + (100 / (ROTATION_TIME / 100));
      });
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [isPlaying, nextSlide, halls, ROTATION_TIME]);

  const currentHall = useMemo(() => halls?.[currentIndex], [halls, currentIndex]);

  if (!halls || halls.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 italic">
      Brak danych do wyświetlenia. Uruchom seed bazy danych.
    </div>
  );

  return (
    <div className="h-full flex flex-col max-w-[2400px] mx-auto px-6 2xl:px-10 py-4">
      {/* MINIMALISTYCZNY NAVBAR — w trybie kiosk strona się nie przewija, więc shrink-0 */}
      <header className="shrink-0 flex items-center justify-between mb-4 2xl:mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-8">
          {/* Play/Pause */}
          <button 
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying) setProgress(0);
            }}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95",
              isPlaying ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-900 border border-slate-200"
            )}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          {/* Wybór Hal */}
          <nav className="flex items-center gap-1">
            {halls.map((hall, idx) => (
              <button
                key={hall.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setProgress(0);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                  idx === currentIndex 
                    ? "bg-slate-50 text-blue-600" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                )}
              >
                {hall.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Pasek Postępu i Link do Planowania */}
        <div className="flex items-center gap-10">
          <ConnectionStatus status={realtimeStatus} lastEventAt={lastEventAt} />

          <div className="flex items-center gap-4 group">
            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-100 ease-linear",
                  isPlaying ? "bg-blue-500" : "bg-slate-300"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 font-mono w-8">
              {currentIndex + 1}/{halls.length}
            </span>
          </div>

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
          </Link>        </div>
      </header>

      {/* TREŚĆ - KAFELKI: wypełnia pozostałą wysokość, siatka wyśrodkowana w pionie */}
      <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="shrink-0 flex items-center gap-4 mb-4 2xl:mb-6">
          <h2 className="text-3xl 2xl:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            {currentHall?.name}
          </h2>
          <div className="h-1 flex-1 bg-slate-50 rounded-full"></div>
        </div>

        {/* Karty mają naturalną, kompaktową wysokość (bez rozciągania na cały ekran,
            więc brak pustki między metrykami a stopką). Siatka zakotwiczona tuż pod
            tytułem (items-start) — tytuł sekcji u góry, kafle bezpośrednio pod nim. */}
        <div className="flex-1 min-h-0 overflow-hidden flex items-start">
          {/* Stała liczba kolumn (3 na ≥lg, 4 na ≥2xl) — szerokość karty jest taka
              sama niezależnie od liczby linii w hali. Hala z 2 liniami pokazuje 2
              kompaktowe karty i zostawia puste tory po prawej, zamiast je rozciągać. */}
          <div className="grid w-full gap-5 2xl:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {currentHall?.lines?.map((line: Line) => (
              <LineCard key={line.id} line={line} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
