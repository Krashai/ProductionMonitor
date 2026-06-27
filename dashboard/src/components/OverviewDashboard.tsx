'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarPlus, Tv2, SlidersHorizontal } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { OverviewLineCard } from './OverviewLineCard';
import { useRealtimeUpdates } from '@/hooks/useRealtime';
import { useHallGridRows } from '@/hooks/useHallGridRows';
import type { AppMode } from '@/lib/settings';
import type { OverviewLine } from './OverviewLineCard';

interface Hall {
  id: string;
  name: string;
  lines: OverviewLine[];
}

interface Props {
  halls: Hall[];
  mode: AppMode;
}

export function OverviewDashboard({ halls, mode }: Props) {
  const { status: realtimeStatus, lastEventAt } = useRealtimeUpdates();
  const lineCounts = useMemo(() => halls.map(h => h.lines.length), [halls]);
  const { outerRef, templateRows } = useHallGridRows(lineCounts);

  if (!halls?.length) {
    return (
      <div className='flex items-center justify-center h-full text-slate-400 italic text-sm'>
        Brak danych do wyświetlenia. Uruchom seed bazy danych.
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col max-w-[2560px] mx-auto px-6 2xl:px-10 py-4'>
      {/* Nagłówek */}
      <header className='shrink-0 flex items-center justify-between mb-4 2xl:mb-5 pb-3 border-b border-slate-100'>
        <div className='flex items-baseline gap-3'>
          <h1 className='text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none'>
            Przegląd Fabryki
          </h1>
          <span className='text-[10px] font-bold text-slate-400 uppercase tracking-widest'>
            {halls.reduce((acc, h) => acc + h.lines.length, 0)} linii
          </span>
        </div>

        <div className='flex items-center gap-8'>
          <ConnectionStatus status={realtimeStatus} lastEventAt={lastEventAt} />

          <nav className='flex items-center gap-5'>
            <Link
              href='/'
              className='flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors'
            >
              <Tv2 size={14} />
              <span className='text-[10px] font-black uppercase tracking-widest'>Monitor</span>
            </Link>
            <Link
              href='/planning'
              className='flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors'
            >
              <CalendarPlus size={14} />
              <span className='text-[10px] font-black uppercase tracking-widest'>Planowanie</span>
            </Link>
            <Link
              href='/reporting'
              className='flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors'
            >
              <BarChart3 size={14} />
              <span className='text-[10px] font-black uppercase tracking-widest'>Raporty</span>
            </Link>
            <Link
              href='/config'
              className='flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors'
            >
              <SlidersHorizontal size={14} />
              <span className='text-[10px] font-black uppercase tracking-widest'>Konfiguracja</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Sekcje hal — gridTemplateRows obliczone dynamicznie przez useHallGridRows:
          liczba fr = liczba rzeczywistych rzędów CSS grid w danej hali, dzięki czemu
          wysokość jednego rzędu kart jest identyczna we wszystkich halach. */}
      <div
        ref={outerRef}
        className='flex-1 min-h-0 grid gap-3 2xl:gap-4'
        style={{ gridTemplateRows: templateRows }}
      >
        {halls.map((hall) => (
          <section key={hall.id} className='min-h-0 overflow-hidden flex flex-col gap-1.5 2xl:gap-2'>
            {/* Nagłówek hali */}
            <div className='shrink-0 flex items-center gap-3'>
              <h2 className='text-[11px] 2xl:text-xs font-black uppercase tracking-[0.2em] text-slate-500 shrink-0'>
                {hall.name}
              </h2>
              <div className='h-px flex-1 bg-slate-100' />
              <span className='text-[9px] 2xl:text-[10px] font-bold text-slate-300 uppercase tracking-widest shrink-0'>
                {hall.lines.length} {hall.lines.length === 1 ? 'linia' : 'linii'}
              </span>
            </div>

            <div
              data-hall-grid
              className='flex-1 min-h-0 grid auto-rows-[minmax(0,1fr)] gap-2 2xl:gap-2.5 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]'
            >
              {hall.lines.map((line) => (
                <OverviewLineCard key={line.id} line={line} mode={mode} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
