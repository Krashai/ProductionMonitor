'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { getReportingData } from '@/app/actions';
import { format, subHours, subDays, startOfDay, endOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  BarChart3,
  RefreshCcw,
  Calendar,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Target,
  Trophy,
  Trash2,
  AlertTriangle,
  Factory,
  CheckCircle2
} from 'lucide-react';
import Link from "next/link";
import { cn } from "@/lib/utils";

type Incident = {
  startTime: string;
  endTime: string;
  durationMs: number;
  comment: string | null;
};

type ParetoItem = {
  name: string;
  downtimeMs: number;
};

type LineReport = {
  id: string;
  name: string;
  stats: {
    scrapCount: number;
    workingTimeMs: number;
    availability: number;
    oee: number;
  };
  prevStats: {
    scrapCount: number;
    workingTimeMs: number;
    availability: number;
    oee: number;
  };
  incidents: Incident[];
};

type HallReport = {
  id: string;
  name: string;
  stats: {
    avgOee: number;
    totalScrap: number;
    avgAvailability: number;
    integrityScore: number;
  };
  prevStats: {
    avgOee: number;
    totalScrap: number;
  };
  pareto: ParetoItem[];
  topScrapLine: {
    name: string;
    count: number;
  } | null;
  lines: LineReport[];
};

type FactorySummary = {
  avgOee: number;
  totalScrap: number;
  prevAvgOee: number;
  healthDistribution: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
};

export const dynamic = 'force-dynamic';

const PRESETS = [
  { label: '8h', getValue: () => ({ from: subHours(new Date(), 8), to: new Date() }) },
  { label: '24h', getValue: () => ({ from: subDays(new Date(), 1), to: new Date() }) },
  { label: 'Dziś', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: '7 dni', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
];

export default function ReportingPage() {
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 1), to: new Date() });
  const [data, setData] = useState<{ factorySummary: FactorySummary, halls: HallReport[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedHalls, setExpandedHalls] = useState<Record<string, boolean>>({});
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    startTransition(async () => {
      const result = await getReportingData(dateRange.from, dateRange.to);
      setData(result);
    });
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleHall = (id: string) => setExpandedHalls(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLine = (id: string) => setExpandedLines(prev => ({ ...prev, [id]: !prev[id] }));

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes} min`;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-20 font-sans text-slate-900 leading-normal tracking-normal">
      {/* NAGŁÓWEK */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-50 mb-8">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100">
              <ArrowLeft size={18} />
            </Link>
            <div className="space-y-0">
              <h1 className="text-xl font-black tracking-tight uppercase leading-none">
                Centrum Raportowania
              </h1>
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">Global Manufacturing Insights</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-xl gap-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setDateRange(preset.getValue())}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    "hover:text-slate-900",
                    false ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:bg-white/50"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button 
              onClick={fetchData}
              disabled={isPending}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCcw size={18} className={cn(isPending && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
        {/* Date Range Summary */}
        <div className="flex items-center gap-3 text-slate-500 bg-white border border-slate-100 px-5 py-2.5 rounded-2xl w-fit shadow-sm shadow-slate-100/50">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">
            {format(dateRange.from, 'dd MMM HH:mm', { locale: pl })} — {format(dateRange.to, 'dd MMM HH:mm', { locale: pl })}
          </span>
        </div>

        {data && (
          <>
            {/* --- GLOBAL EXECUTIVE SUMMARY (VERSION SLIM) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
              {/* Lewa: Global KPIs */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Global OEE */}
                <div className="bg-white rounded-[2rem] border border-slate-100 p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                  <div className="space-y-1">
                    <p className="text-[12px] text-blue-600 font-black uppercase tracking-widest">Globalny wskaźnik OEE</p>
                    <h3 className="text-6xl font-black text-slate-900 font-mono tracking-tighter leading-none group-hover:translate-x-1 transition-transform duration-500">
                      {data.factorySummary.avgOee.toFixed(1)}%
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={cn(
                      "flex items-center px-2 py-0.5 rounded-lg text-[11px] font-black",
                      data.factorySummary.avgOee >= data.factorySummary.prevAvgOee ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                    )}>
                      {data.factorySummary.avgOee >= data.factorySummary.prevAvgOee ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span className="ml-1">{Math.abs(data.factorySummary.avgOee - data.factorySummary.prevAvgOee).toFixed(1)}%</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">vs poprz. okres</span>
                  </div>
                </div>

                {/* Global Scrap */}
                <div className="bg-white rounded-[2rem] border border-slate-100 p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                  <div className="space-y-1">
                    <p className="text-[12px] text-rose-600 font-black uppercase tracking-widest">Łączna liczba odrzutów</p>
                    <h3 className="text-6xl font-black text-slate-900 font-mono tracking-tighter leading-none group-hover:translate-x-1 transition-transform duration-500">
                      {data.factorySummary.totalScrap}
                    </h3>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4">Suma sztuk wadliwych</p>
                </div>
              </div>

              {/* Prawa: Health Distribution */}
              <div className="lg:col-span-5 bg-white rounded-[2rem] border border-slate-100 p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div className="space-y-0.5">
                  <p className="text-[12px] text-emerald-600 font-black uppercase tracking-widest leading-none">Kondycja parku maszynowego</p>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Rozkład efektywności</h3>
                </div>
                
                <div className="space-y-6 mt-4">
                  <div className="w-full h-5 bg-slate-50 rounded-full overflow-hidden flex shadow-inner border border-slate-100/50">
                    <div 
                      className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-1000" 
                      style={{ width: `${(data.factorySummary.healthDistribution.green / data.factorySummary.healthDistribution.total) * 100}%` }} 
                    />
                    <div 
                      className="h-full bg-amber-400 transition-all duration-1000" 
                      style={{ width: `${(data.factorySummary.healthDistribution.yellow / data.factorySummary.healthDistribution.total) * 100}%` }} 
                    />
                    <div 
                      className="h-full bg-rose-500 transition-all duration-1000" 
                      style={{ width: `${(data.factorySummary.healthDistribution.red / data.factorySummary.healthDistribution.total) * 100}%` }} 
                    />
                  </div>

                  <div className="flex flex-row justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">&gt; 85% ({data.factorySummary.healthDistribution.green})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full" />
                      <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">60-85% ({data.factorySummary.healthDistribution.yellow})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-rose-500 rounded-full" />
                      <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">&lt; 60% ({data.factorySummary.healthDistribution.red})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --- HALL REPORTS --- */}
            <div className="space-y-8 mt-12 pt-12 border-t border-slate-100">
              <div className="flex items-center gap-4 mb-4 px-2">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Szczegółowa Analityka Hal</h3>
              </div>
              <div className="space-y-8">
                {data.halls.map((hall) => (
                  <div key={hall.id} className="group">
                    <div className={cn(
                      "bg-white rounded-[2.5rem] border transition-all duration-500 overflow-hidden",
                      expandedHalls[hall.id] ? "border-slate-200 shadow-xl shadow-slate-200/40" : "border-slate-100 shadow-sm hover:border-slate-200"
                    )}>
                      {/* Header Karty Hali */}
                      <div 
                        onClick={() => toggleHall(hall.id)}
                        className="p-8 flex items-center justify-between cursor-pointer group/header"
                      >
                        <div className="flex items-center gap-12">
                          <div className="w-48">
                            <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-1">Hala Produkcyjna</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">{hall.name}</h2>
                          </div>
                          
                          <div className="h-10 w-px bg-slate-100" />

                          <div className="flex gap-12">
                            <div className="space-y-1">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Średni OEE</p>
                              <div className="flex items-center gap-3">
                                <span className="text-4xl font-black text-slate-900 font-mono tracking-tighter leading-none">{hall.stats.avgOee.toFixed(1)}%</span>
                                <div className={cn(
                                  "flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black h-fit",
                                  hall.stats.avgOee >= hall.prevStats.avgOee ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                                )}>
                                  {hall.stats.avgOee >= hall.prevStats.avgOee ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  <span className="ml-1">{Math.abs(hall.stats.avgOee - hall.prevStats.avgOee).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Sztuk Scrap</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-900 font-mono tracking-tighter leading-none">{hall.stats.totalScrap}</span>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Σ szt</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500",
                          expandedHalls[hall.id] ? "bg-slate-900 text-white rotate-180" : "bg-slate-50 text-slate-300 group-hover/header:bg-slate-100"
                        )}>
                          <ChevronDown size={24} strokeWidth={3} />
                        </div>
                      </div>

                      {/* PANEL ANALITYCZNY HALI */}
                      {expandedHalls[hall.id] && (
                        <div className="px-8 pb-8 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-white rounded-[1.5rem] p-8 border border-slate-100 flex flex-col justify-between relative overflow-hidden group/scrap shadow-sm hover:shadow-md transition-all h-full min-h-[200px]">
                              <div className="relative z-10 flex items-start gap-4">
                                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                                  <Target size={20} className="text-rose-600" />
                                </div>
                                <div className="space-y-0.5 mt-0.5">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lider Odrzutów</p>
                                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">{hall.topScrapLine?.name || 'Brak'}</h3>
                                </div>
                              </div>
                              <div className="relative z-10 flex items-center justify-between mt-auto">
                                <div className="space-y-0.5">
                                  <div className="text-5xl font-black font-mono tracking-tighter text-rose-600 leading-none">{hall.topScrapLine?.count || 0}</div>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Sztuk wadliwych</p>
                                </div>
                                <Trophy size={40} className="text-slate-100 group-hover/scrap:text-rose-100 group-hover/scrap:scale-110 transition-all duration-500 shrink-0" />
                              </div>
                            </div>

                            <div className="bg-white rounded-[1.5rem] p-8 border border-slate-100 flex flex-col shadow-sm hover:shadow-md transition-all h-full min-h-[200px]">
                              <div className="flex items-center gap-3 mb-6">
                                <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center">
                                  <Zap size={14} className="text-amber-500 fill-amber-500" />
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Najwięcej Strat</h3>
                              </div>
                              <div className="flex-1 flex flex-col justify-center space-y-4">
                                {hall.pareto.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between group/line-p">
                                    <div className="flex items-center gap-4">
                                      <span className="text-[9px] font-black text-slate-200 font-mono w-4">0{idx+1}</span>
                                      <span className="font-black text-slate-700 uppercase tracking-tight text-sm leading-none group-hover/line-p:text-blue-600 transition-colors">{item.name}</span>
                                    </div>
                                    <span className="text-[11px] font-black text-rose-500 font-mono tracking-tight bg-rose-50 px-2.5 py-1 rounded-lg leading-none">{formatDuration(item.downtimeMs)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white rounded-[1.5rem] p-8 border border-slate-100 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full min-h-[200px]">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                                  <ShieldCheck size={20} className="text-emerald-600" />
                                </div>
                                <div className="space-y-0.5 mt-0.5">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Jakość Raportowania</p>
                                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Spójność danych</h3>
                                </div>
                              </div>
                              <div className="space-y-4 mt-auto">
                                <div className="text-5xl font-black font-mono tracking-tighter leading-none text-slate-900">{hall.stats.integrityScore.toFixed(0)}%</div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out"
                                    style={{ width: `${hall.stats.integrityScore}%` }}
                                  />
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Zweryfikowane przestoje</p>
                              </div>
                            </div>
                          </div>

                          {/* LISTA LINII */}
                          <div className="space-y-4 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-between px-2 mb-2">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2 border-l-2 border-blue-500 ml-1">Zestawienie Maszyn</h3>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{hall.lines.length} Aktywnych jednostek</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {hall.lines.map((line) => (
                                <div key={line.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all duration-300 group/line">
                                  <div 
                                    onClick={() => toggleLine(line.id)}
                                    className="p-5 flex items-center justify-between cursor-pointer"
                                  >
                                    <div className="flex items-center gap-10">
                                      <div className={cn(
                                        "w-1.5 h-10 rounded-full shrink-0 transition-all duration-700",
                                        line.stats.oee > 85 ? "bg-emerald-500" : line.stats.oee > 60 ? "bg-amber-500" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                      )} />
                                      <div className="w-32 shrink-0">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase group-hover/line:text-blue-600 transition-colors leading-none">{line.name}</h3>
                                      </div>
                                      
                                      <div className="h-8 w-px bg-slate-50 shrink-0" />

                                      <div className="flex gap-16 ml-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                            <Target size={14} />
                                          </div>
                                          <div className="space-y-0">
                                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Wydajność</p>
                                            <p className="text-xl font-black text-slate-800 font-mono tracking-tighter leading-none">{line.stats.oee.toFixed(1)}%</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", line.stats.scrapCount > 5 ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400")}>
                                            <Trash2 size={14} />
                                          </div>
                                          <div className="space-y-0">
                                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Odrzuty</p>
                                            <p className="text-xl font-black text-slate-800 font-mono tracking-tighter leading-none">{line.stats.scrapCount}</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", line.incidents.length > 0 ? "bg-amber-50 text-amber-500" : "bg-slate-50 text-slate-400")}>
                                            <AlertTriangle size={14} />
                                          </div>
                                          <div className="space-y-0">
                                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Zdarzenia</p>
                                            <p className="text-xl font-black text-slate-800 font-mono tracking-tighter leading-none">{line.incidents.length}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 px-4">
                                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest opacity-0 group-hover/line:opacity-100 transition-opacity">Szczegóły</span>
                                      <div className={cn("p-2 rounded-lg transition-all duration-300", expandedLines[line.id] ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-200")}>
                                        <ChevronDown size={18} className={cn("transition-transform duration-300", expandedLines[line.id] && "rotate-180")} />
                                      </div>
                                    </div>
                                  </div>

                                  {expandedLines[line.id] && (
                                    <div className="p-6 pt-0 animate-in fade-in slide-in-from-top-1 duration-500">
                                      {line.incidents.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                          {line.incidents.map((inc, idx) => (
                                            <div key={idx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 hover:bg-white hover:shadow-md transition-all group/inc">
                                              <div className="flex items-center justify-between mb-4">
                                                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                                                  <Clock size={14} className="text-amber-500" />
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-[10px] font-black text-slate-900 font-mono uppercase tracking-tight">
                                                    {format(new Date(inc.startTime), 'HH:mm')} — {format(new Date(inc.endTime), 'HH:mm')}
                                                  </div>
                                                  <div className="text-[9px] font-black text-rose-500 uppercase mt-0.5 tracking-widest">{formatDuration(inc.durationMs)}</div>
                                                </div>
                                              </div>
                                              {inc.comment ? (
                                                <div className="relative p-3 bg-white rounded-xl border border-slate-100 text-[11px] text-slate-500 italic leading-relaxed shadow-sm">
                                                  &quot;{inc.comment}&quot;
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-widest text-rose-400 bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 border-dashed">
                                                  <AlertCircle size={12} className="shrink-0" />
                                                  <span>Brak opisu</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center py-10 bg-emerald-50/10 rounded-2xl border border-dashed border-emerald-100 flex items-center justify-center gap-3">
                                          <CheckCircle2 className="text-emerald-500" size={16} />
                                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/50">Linia bez incydentów w tym okresie</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!data && !isPending && (
          <div className="text-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="text-slate-200" size={40} />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Brak danych dla wybranego zakresu czasu</p>
          </div>
        )}
      </main>
    </div>
  );
}
