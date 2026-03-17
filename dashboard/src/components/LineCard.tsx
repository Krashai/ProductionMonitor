import { StatusBadge } from "./StatusBadge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Unplug } from "lucide-react";

interface LineCardProps {
  line: {
    id: string;
    name: string;
    plcId: string;
    isOnline: boolean;
    history: { status: boolean; speed: number; time: string }[];
    plans: { id: string; productIndex: string }[];
    _count: { scrap: number };
  };
}

export function LineCard({ line }: LineCardProps) {
  const latest = line.history[0];
  const currentStatus = latest?.status;
  const currentSpeed = latest?.speed || 0;
  const scrapCount = line._count.scrap;
  const activePlan = line.plans[0];
  const hasActivePlan = !!activePlan;

  const isWorkingAsPlanned = hasActivePlan && currentStatus === true && line.isOnline;
  const isAlarmState = hasActivePlan && currentStatus === false && line.isOnline;
  const isOffline = !line.isOnline;

  return (
    <Link href={`/line/${line.id}`} className={cn("block group", isOffline && "opacity-75 grayscale-[0.5]")}>
      <div className={cn(
        "relative bg-white border rounded-2xl transition-all duration-500 overflow-hidden h-full flex flex-col justify-between",
        "group-hover:shadow-[0_25px_50px_rgb(0,0,0,0.06)] group-hover:-translate-y-1",
        isWorkingAsPlanned && "border-emerald-100",
        isAlarmState && "border-rose-200 animate-pulse-subtle",
        isOffline && "border-slate-200 bg-slate-50/30",
        !hasActivePlan && !isOffline && "border-slate-100 shadow-sm"
      )}>
        {/* Pionowy pasek statusu */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-2.5 transition-all duration-500",
          isWorkingAsPlanned ? "bg-emerald-500 shadow-[2px_0_15px_rgba(16,185,129,0.2)]" : 
          isAlarmState ? "bg-rose-500 shadow-[2px_0_20px_rgba(225,29,72,0.3)]" : 
          isOffline ? "bg-slate-300" :
          "bg-slate-100"
        )} />

        <div className="p-8 pl-10 space-y-10">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-2xl tracking-tighter uppercase leading-none group-hover:text-blue-600 transition-colors">
                {line.name}
              </h3>
              {isOffline && (
                <div className="flex items-center gap-1.5 text-rose-500 mt-2">
                  <Unplug size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Brak połączenia</span>
                </div>
              )}
            </div>
            <StatusBadge status={isOffline ? undefined : currentStatus} />
          </div>

          {/* Metryki */}
          <div className="flex items-end gap-12">
            <div className="space-y-1">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Prędkość</p>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-5xl font-black font-mono tracking-tighter",
                  isAlarmState ? "text-rose-600" : "text-slate-900",
                  isOffline && "text-slate-400"
                )}>
                  {isOffline ? "---" : currentSpeed.toFixed(1)}
                </span>
                <span className="text-[10px] font-bold text-slate-300 uppercase">m/min</span>
              </div>
            </div>

            <div className="space-y-1 ml-auto text-right">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Scrap (1h)</p>
              <div className="flex items-baseline justify-end gap-2 text-slate-900">
                <span className={cn(
                  "text-5xl font-black font-mono tracking-tighter",
                  isOffline && "text-slate-400"
                )}>
                  {isOffline ? "---" : scrapCount}
                </span>
                <span className="text-[10px] font-bold text-slate-300 uppercase">szt.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dolna sekcja z Indeksem */}
        <div className={cn(
          "px-10 py-4 border-t transition-colors",
          hasActivePlan ? (isOffline ? "bg-slate-400 border-slate-400" : "bg-slate-900 border-slate-900") : "bg-slate-50 border-slate-50"
        )}>
          {hasActivePlan ? (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Aktualny Indeks</span>
              <span className="text-sm font-black text-white uppercase tracking-widest">{activePlan.productIndex}</span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Brak aktywnego zlecenia</span>
          )}
        </div>
      </div>
    </Link>
  );
}
