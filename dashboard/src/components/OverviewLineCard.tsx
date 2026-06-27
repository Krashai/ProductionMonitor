'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
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
  const isWorking = accentForVariant(variant) === 'green';

  return (
    <Link
      href={`/line/${line.id}`}
      aria-label={`Przejdź do linii ${line.name}`}
      className='block group min-w-0 h-full'
    >
      <div className={cn(
        'h-full rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 px-3',
        'group-hover:-translate-y-0.5 group-hover:shadow-lg',
        isWorking
          ? 'bg-emerald-500'
          : 'bg-slate-200',
      )}>
        <span className={cn(
          'font-black uppercase tracking-tight leading-none text-center w-full truncate',
          'text-2xl 2xl:text-3xl',
          isWorking ? 'text-white/90' : 'text-slate-500',
        )}>
          {line.name}
        </span>

        <div className='flex items-baseline gap-1.5'>
          <span className={cn(
            'font-black font-mono tabular-nums leading-none',
            'text-4xl 2xl:text-5xl',
            isWorking ? 'text-white' : 'text-slate-400',
          )}>
            {isOffline ? '—' : currentSpeed.toFixed(1)}
          </span>
          <span className={cn(
            'font-bold uppercase leading-none text-xs 2xl:text-sm',
            isWorking ? 'text-white/60' : 'text-slate-400',
          )}>
            m/min
          </span>
        </div>
      </div>
    </Link>
  );
}
