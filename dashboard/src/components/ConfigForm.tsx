'use client';

import { useState, useTransition } from 'react';
import { CalendarRange, Gauge, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppMode } from '@/lib/settings';
import { updateAppMode } from '@/app/config/actions';

interface ConfigFormProps {
  initialMode: AppMode;
}

interface ModeOption {
  value: AppMode;
  title: string;
  description: string;
  icon: typeof CalendarRange;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'PLAN_MODE',
    title: 'Z planami produkcji',
    description:
      'Kafelki pokazują aktualny indeks zlecenia i porównują pracę z planem. Pełna analityka: OEE, dostępność i cele w raportach.',
    icon: CalendarRange,
  },
  {
    value: 'NO_PLAN_MODE',
    title: 'Bez planów produkcji',
    description:
      'Uproszczony widok: prędkość, scrap i status linii. Zielony kafelek „Linia pracuje", szary „Postój". Bez OEE, celów i indeksów.',
    icon: Gauge,
  },
];

type SaveState =
  | { kind: 'idle' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ConfigForm({ initialMode }: ConfigFormProps) {
  const [savedMode, setSavedMode] = useState<AppMode>(initialMode);
  const [selected, setSelected] = useState<AppMode>(initialMode);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();

  const isDirty = selected !== savedMode;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || isPending) return;

    const chosen = selected;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('mode', chosen);
      const result = await updateAppMode(formData);

      if (result.success) {
        setSavedMode(result.mode);
        setSaveState({ kind: 'success' });
      } else {
        setSaveState({ kind: 'error', message: result.error });
      }
    });
  }

  function pick(mode: AppMode) {
    setSelected(mode);
    if (saveState.kind !== 'idle') setSaveState({ kind: 'idle' });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Tryb pracy monitora
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Decyduje, jak kafelki linii prezentują dane na wallboardzie. Zmiana
            obowiązuje natychmiast na wszystkich ekranach.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODE_OPTIONS.map((option) => {
            const isActive = selected === option.value;
            const isCurrent = savedMode === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => pick(option.value)}
                aria-pressed={isActive}
                className={cn(
                  'relative text-left rounded-2xl border-2 p-5 transition-all duration-200 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-blue-500/40',
                  isActive
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                      Aktywny
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {option.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-1.5">
                  {option.description}
                </p>
                {isActive && (
                  <span className="absolute top-4 right-4 sm:hidden text-blue-600">
                    <Check size={18} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Pasek akcji + feedback */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-h-[24px] flex items-center" aria-live="polite">
          {saveState.kind === 'success' && (
            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600">
              <Check size={16} /> Zapisano. Tryb zaktualizowany.
            </span>
          )}
          {saveState.kind === 'error' && (
            <span className="inline-flex items-center gap-2 text-sm font-bold text-rose-600">
              <AlertCircle size={16} /> {saveState.message}
            </span>
          )}
          {saveState.kind === 'idle' && isDirty && (
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
              Niezapisane zmiany
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!isDirty || isPending}
          className={cn(
            'inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] px-7 py-4 rounded-2xl transition-all active:scale-[0.98]',
            !isDirty || isPending
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          )}
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Zapisywanie
            </>
          ) : (
            'Zapisz zmiany'
          )}
        </button>
      </div>
    </form>
  );
}
