'use client';

import Link from 'next/link';
import { Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { deriveLineVisualState } from '@/lib/line-visual-state';
import { accentForVariant } from '@/lib/line-accent';
import { useLineStaleness } from '@/hooks/useLineStaleness';
import type { AppMode } from '@/lib/settings';

export interface OverviewLine {
  id: string;
  name: string;
  plcId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  history: { status: boolean; speed: number; time: string }[];
  plans: { id: string; productIndex: string }[];
  _count: { scrap: number };
}

interface OverviewLineCardProps {
  line: OverviewLine;
  mode: AppMode;
}

export function OverviewLineCard({ line, mode }: OverviewLineCardProps) {
  const latest = line.history[0];
  const currentStatus = latest?.status;
  const currentSpeed = latest?.speed ?? 0;
  const scrapCount = line._count.scrap;
  const activePlan = line.plans[0];
  const hasActivePlan = !!activePlan;

  const isStale = useLineStaleness(line.lastSeenAt);
  const isOffline = !line.isOnline || isStale;

  const { variant } = deriveLineVisualState({
    mode,
    isOffline,
    hasActivePlan,
    status: currentStatus,
    speed: currentSpeed,
  });
  const accent = accentForVariant(variant);

  const isNoPlanMode = mode === 'NO_PLAN_MODE';
  const isGreen = accent === 'green';
  const isAlarm = accent === 'alarm';

  const badgeStatus = isOffline
    ? undefined
    : isNoPlanMode
      ? (isGreen ? true : undefined)
      : currentStatus;

  const footerLabel = isOffline
    ? 'Offline'
    : isNoPlanMode
      ? (isGreen ? 'Praca' : 'Postój')
      : (activePlan?.productIndex ?? '—');

  return (
    // h-full: karta wypełnia komórkę siatki (auto-rows-[1fr] w OverviewDashboard)
    <Link
      href={`/line/${line.id}`}
      aria-label={`Przejdź do linii ${line.name}`}
      className={cn('block group min-w-0 h-full', isOffline && 'opacity-70 grayscale-[0.4]')}
    >
      <div className={cn(
        'relative bg-white border rounded-xl transition-all duration-300 overflow-hidden h-full flex flex-col',
        'group-hover:shadow-md group-hover:-translate-y-0.5',
        accent === 'green'   && 'border-emerald-100',
        accent === 'alarm'   && 'border-rose-200 animate-pulse-subtle',
        accent === 'offline' && 'border-slate-200 bg-slate-50/40',
        accent === 'neutral' && 'border-slate-100',
      )}>
        {/* Pionowy pasek akcentu */}
        <div className={cn(
          'absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300',
          accent === 'green'   ? 'bg-emerald-500' :
          accent === 'alarm'   ? 'bg-rose-500' :
          accent === 'offline' ? 'bg-slate-300' :
          'bg-slate-100',
        )} />

        {/* flex-1: treść wypełnia wysokość karty, metryki wyśrodkowane w pionie */}
        <div className='flex-1 pl-4 pr-3 py-2 2xl:pl-5 2xl:pr-4 2xl:py-3 flex flex-col justify-between'>
          {/* Nagłówek: nazwa + badge */}
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <h3 className={cn(
                'font-black uppercase tracking-tight leading-none truncate',
                'text-[11px] 2xl:text-sm',
                isOffline ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-600 transition-colors',
              )}>
                {line.name}
              </h3>
              {isOffline && (
                <div className='flex items-center gap-1 mt-0.5'>
                  <Unplug size={8} className='text-rose-400 shrink-0' />
                  <span className='text-[8px] 2xl:text-[9px] font-bold text-rose-400 uppercase tracking-widest'>
                    Brak połączenia
                  </span>
                </div>
              )}
            </div>
            <StatusBadge status={badgeStatus} className='w-4 h-4 2xl:w-5 2xl:h-5 shrink-0' />
          </div>

          {/* Metryki — wyśrodkowane w dostępnej przestrzeni */}
          <div className='flex items-baseline justify-between gap-2'>
            <div className='flex items-baseline gap-1 min-w-0'>
              <span className={cn(
                'font-black font-mono tabular-nums leading-none',
                'text-lg 2xl:text-2xl',
                isAlarm ? 'text-rose-600' : isOffline ? 'text-slate-300' : 'text-slate-900',
              )}>
                {isOffline ? '—' : currentSpeed.toFixed(1)}
              </span>
              <span className='text-[8px] 2xl:text-[9px] font-bold text-slate-300 uppercase shrink-0'>m/min</span>
            </div>
            <div className='flex items-baseline gap-1 min-w-0 text-right'>
              <span className={cn(
                'font-black font-mono tabular-nums leading-none',
                'text-lg 2xl:text-2xl',
                isOffline ? 'text-slate-300' : 'text-slate-900',
              )}>
                {isOffline ? '—' : scrapCount}
              </span>
              <span className='text-[8px] 2xl:text-[9px] font-bold text-slate-300 uppercase shrink-0'>szt.</span>
            </div>
          </div>

          {/* Stopka: status/indeks zlecenia */}
          <div className={cn(
            'text-[9px] 2xl:text-[10px] font-bold uppercase tracking-widest truncate',
            isOffline ? 'text-slate-300' :
            isGreen    ? 'text-emerald-600' :
            isAlarm    ? 'text-rose-500' :
            'text-slate-400',
          )}>
            {footerLabel}
          </div>
        </div>
      </div>
    </Link>
  );
}
