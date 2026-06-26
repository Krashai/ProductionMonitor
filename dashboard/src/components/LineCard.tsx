'use client';

import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Unplug } from "lucide-react";
import type { AppMode } from "@/lib/settings";
import { deriveLineVisualState, type LineVisualVariant } from "@/lib/line-visual-state";

interface LineCardProps {
  mode: AppMode;
  line: {
    id: string;
    name: string;
    plcId: string;
    isOnline: boolean;
    lastSeenAt: string | null;
    history: { status: boolean; speed: number; time: string }[];
    plans: { id: string; productIndex: string }[];
    _count: { scrap: number };
  };
}

// Po 30s ciszy z gateway uznajemy linię za offline niezależnie od isOnline.
// Worker zapisuje heartbeat co 10s (touch_last_seen), więc 30s = 3 stracone heartbeaty.
// Chroni przed "gateway-down" pokazującym stare wartości jako żywe.
const STALE_THRESHOLD_MS = 30_000;

// Akcent kafelka — wspólny dla obu trybów. Pochodzi z wariantu wizualnego,
// żeby PLAN_MODE i NO_PLAN_MODE mapowały na te same klasy Tailwind.
type Accent = 'green' | 'alarm' | 'neutral' | 'offline';

function accentForVariant(variant: LineVisualVariant): Accent {
  switch (variant) {
    case 'offline':
      return 'offline';
    case 'plan-working':
    case 'no-plan-running':
      return 'green';
    case 'plan-alarm':
      return 'alarm';
    case 'plan-idle':
    case 'no-plan-stopped':
      return 'neutral';
  }
}

export function LineCard({ line, mode }: LineCardProps) {
  const latest = line.history[0];
  const currentStatus = latest?.status;
  const currentSpeed = latest?.speed || 0;
  const scrapCount = line._count.scrap;
  const activePlan = line.plans[0];
  const hasActivePlan = !!activePlan;

  // Tick co 5s żeby badge przeszedł w "offline" automatycznie po przekroczeniu
  // progu, nawet bez router.refresh() (np. gateway umarł i przestał wysyłać eventy).
  // SSR + hydration: initial state = false (mamy świeże dane), useEffect ustawia
  // poprawną wartość po mount — unika hydration mismatch z Date.now().
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const lastSeenMs = line.lastSeenAt ? new Date(line.lastSeenAt).getTime() : 0;
    const check = () => {
      setIsStale(!lastSeenMs || Date.now() - lastSeenMs > STALE_THRESHOLD_MS);
    };
    check();
    const interval = setInterval(check, 5_000);
    return () => clearInterval(interval);
  }, [line.lastSeenAt]);

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

  // Badge: w PLAN_MODE zachowujemy dokładnie poprzednie zachowanie (status z PLC).
  // W NO_PLAN_MODE badge zgodny z kafelkiem: zielony gdy pracuje, szary (Postój)
  // w przeciwnym razie — bez czerwonej kropki, bo to nie alarm planu.
  const badgeStatus = isOffline
    ? undefined
    : isNoPlanMode
      ? (isGreen ? true : undefined)
      : currentStatus;

  return (
    // h-full + min-w-0: kafelek wypełnia komórkę siatki (auto-rows-fr) i może się
    // zwężać bez wypychania treści poza kartę.
    <Link href={`/line/${line.id}`} className={cn("block group h-full min-w-0", isOffline && "opacity-75 grayscale-[0.5]")}>
      <div className={cn(
        "relative bg-white border rounded-2xl transition-all duration-500 overflow-hidden h-full flex flex-col",
        "group-hover:shadow-[0_25px_50px_rgb(0,0,0,0.06)] group-hover:-translate-y-1",
        accent === 'green' && "border-emerald-100",
        accent === 'alarm' && "border-rose-200 animate-pulse-subtle",
        accent === 'offline' && "border-slate-200 bg-slate-50/30",
        accent === 'neutral' && "border-slate-100 shadow-sm"
      )}>
        {/* Pionowy pasek statusu */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-2 2xl:w-2.5 transition-all duration-500",
          accent === 'green' ? "bg-emerald-500 shadow-[2px_0_15px_rgba(16,185,129,0.2)]" :
          accent === 'alarm' ? "bg-rose-500 shadow-[2px_0_20px_rgba(225,29,72,0.3)]" :
          accent === 'offline' ? "bg-slate-300" :
          "bg-slate-100"
        )} />

        {/* TREŚĆ: nazwa u góry, metryki wyśrodkowane w pionie, stopka na dole.
            min-h ujednolica wysokość kart online/offline (offline ma dodatkowy wiersz
            „Brak połączenia") i daje metrykom trochę oddechu — bez rozciągania. */}
        <div className="flex-1 flex flex-col p-5 pl-7 2xl:p-8 2xl:pl-10 min-h-[120px] 2xl:min-h-[150px]">
          {/* Header */}
          <div className="shrink-0 flex justify-between items-start gap-3">
            <div className="space-y-1 min-w-0">
              <h3 className="font-black text-slate-900 text-xl 2xl:text-2xl tracking-tighter uppercase leading-none group-hover:text-blue-600 transition-colors truncate">
                {line.name}
              </h3>
              {isOffline && (
                <div className="flex items-center gap-1.5 text-rose-500 mt-2">
                  <Unplug size={12} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest truncate">Brak połączenia</span>
                </div>
              )}
            </div>
            <StatusBadge status={badgeStatus} />
          </div>

          {/* Metryki — wyśrodkowane w dostępnej przestrzeni */}
          <div className="flex-1 min-h-0 flex items-center">
            <div className="w-full flex items-end justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Prędkość</p>
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className={cn(
                    "text-4xl 2xl:text-5xl font-black font-mono tracking-tighter tabular-nums leading-none truncate",
                    isAlarm ? "text-rose-600" : "text-slate-900",
                    isOffline && "text-slate-400"
                  )}>
                    {isOffline ? "---" : currentSpeed.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase shrink-0">m/min</span>
                </div>
              </div>

              <div className="space-y-1 min-w-0 text-right">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Scrap (1h)</p>
                <div className="flex items-baseline justify-end gap-1.5 text-slate-900 min-w-0">
                  <span className={cn(
                    "text-4xl 2xl:text-5xl font-black font-mono tracking-tighter tabular-nums leading-none truncate",
                    isOffline && "text-slate-400"
                  )}>
                    {isOffline ? "---" : scrapCount}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase shrink-0">szt.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dolna sekcja.
            NO_PLAN_MODE: etykieta statusu (Linia pracuje / Postój / Brak połączenia).
            PLAN_MODE: aktualny indeks zlecenia — DOKŁADNIE jak dotychczas. */}
        {isNoPlanMode ? (
          <div className={cn(
            "shrink-0 px-7 2xl:px-10 py-3 2xl:py-4 border-t transition-colors",
            isOffline ? "bg-slate-400 border-slate-400" :
            isGreen ? "bg-emerald-600 border-emerald-600" :
            "bg-slate-200 border-slate-200"
          )}>
            <span className={cn(
              "text-sm font-black uppercase tracking-widest",
              isOffline ? "text-white/80" :
              isGreen ? "text-white" :
              "text-slate-600"
            )}>
              {isOffline ? "Brak połączenia" : isGreen ? "Linia pracuje" : "Postój"}
            </span>
          </div>
        ) : (
          <div className={cn(
            "shrink-0 px-7 2xl:px-10 py-3 2xl:py-4 border-t transition-colors",
            hasActivePlan ? (isOffline ? "bg-slate-400 border-slate-400" : "bg-slate-900 border-slate-900") : "bg-slate-50 border-slate-50"
          )}>
            {hasActivePlan ? (
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] shrink-0">Aktualny Indeks</span>
                <span className="text-sm font-black text-white uppercase tracking-widest truncate">{activePlan.productIndex}</span>
              </div>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Brak aktywnego zlecenia</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
