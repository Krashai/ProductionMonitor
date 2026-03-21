'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineCard } from "./LineCard";
import { Play, Pause, CalendarPlus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from 'next/navigation';

interface Line {
  id: string;
  name: string;
  plcId: string;
  isOnline: boolean;
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

  const ROTATION_TIME = 10000;
  const POLLING_INTERVAL = 1000;

  // 1. Polling danych z serwera
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [router]);

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
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      {/* MINIMALISTYCZNY NAVBAR */}
      <header className="flex items-center justify-between mb-12 py-4 border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
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
            <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Planowanie</span>
          </Link>

          <Link 
            href="/reporting" 
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
          >
            <BarChart3 size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Raporty</span>
          </Link>
        </div>
      </header>

      {/* TREŚĆ - KAFELKI */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-4 mb-10">
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">
            {currentHall?.name}
          </h2>
          <div className="h-1 flex-1 bg-slate-50 mt-4 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {currentHall?.lines?.map((line: Line) => (
            <LineCard key={line.id} line={line} />
          ))}
        </div>
      </div>
    </div>
  );
}
