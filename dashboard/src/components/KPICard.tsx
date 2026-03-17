'use client'

import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Counter } from "./Counter";

interface KPICardProps {
  label: string;
  value: number;
  unit?: string;
  icon: LucideIcon;
  color: "emerald" | "blue" | "rose";
  description?: string;
  tooltip: string;
  decimals?: number;
  className?: string;
}

export function KPICard({ label, value, unit, icon: Icon, color, description, tooltip, decimals = 1, className }: KPICardProps) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
  };

  return (
    <div className={cn(
      "group relative bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] flex flex-col",
      className
    )}>
      {/* Top row: Icon and Tooltip */}
      <div className="flex items-start justify-between shrink-0">
        <div className={cn("p-3 rounded-2xl border transition-all duration-500 group-hover:scale-110 shadow-sm", colorMap[color])}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
        
        {/* Info Tooltip Icon */}
        <div className="relative group/tooltip">
          <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
            <Info size={18} />
          </button>
          
          {/* Tooltip Popup */}
          <div className="absolute top-0 right-full mr-4 w-80 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/tooltip:translate-x-0 z-[110]">
            <div className="bg-slate-900 text-white text-sm font-medium p-6 rounded-[1.5rem] shadow-2xl border border-slate-800 leading-relaxed">
              <div className="flex items-center gap-2 mb-3 text-blue-400 font-black uppercase tracking-widest text-[10px]">
                <Info size={14} />
                <span>Definicja Metryki</span>
              </div>
              <p className="text-slate-200 antialiased">
                {tooltip}
              </p>
            </div>
            <div className="w-3 h-3 bg-slate-900 rotate-45 absolute top-5 right-[-6px] border-r border-t border-slate-800"></div>
          </div>
        </div>
      </div>

      {/* Main Content: CENTERED */}
      <div className="flex-1 flex flex-col justify-center items-center text-center py-6">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">{label}</h3>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-8xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
            <Counter value={value} decimals={decimals} />
          </span>
          {unit && (
            <span className="text-2xl font-black text-slate-300 uppercase tracking-tighter">{unit}</span>
          )}
        </div>
      </div>

      {/* Footer: Decoration */}
      <div className="shrink-0 pt-6 border-t border-slate-50 flex justify-center items-center gap-3">
        <div className={cn("w-1 h-1 rounded-full", color === 'emerald' ? 'bg-emerald-400' : color === 'blue' ? 'bg-blue-400' : 'bg-rose-400')} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          {description}
        </p>
        <div className={cn("w-1 h-1 rounded-full", color === 'emerald' ? 'bg-emerald-400' : color === 'blue' ? 'bg-blue-400' : 'bg-rose-400')} />
      </div>
    </div>
  );
}
