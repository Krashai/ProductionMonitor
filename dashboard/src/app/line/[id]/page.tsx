'use client'

import { getLineDetails } from "@/app/actions";
import { notFound } from "next/navigation";
import { LineDiagnostics } from "@/components/LineDiagnostics";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { subHours, format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { useRealtimeUpdates } from "@/hooks/useRealtime";
import { use, useEffect, useState } from "react";

interface Props {
  params: Promise<{ id: string }>;
}

export default function LineDetailsPage({ params }: Props) {
  const { id } = use(params);
  const [line, setLine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useRealtimeUpdates();

  // Definiujemy daty w zasięgu komponentu, aby były dostępne w JSX
  const now = new Date();
  const from = subHours(now, 24);
  const to = subHours(now, -8);

  useEffect(() => {
    const startTime = performance.now();
    console.log(`[PERF] Fetching details for line ${id}...`);

    getLineDetails(id, from, to).then(data => {
      const endTime = performance.now();
      console.log(`[PERF] Data fetched in ${(endTime - startTime).toFixed(2)}ms`);
      setLine(data);
      setLoading(false);
      
      // RequestAnimationFrame zapewnia, że mierzymy czas po tym, jak przeglądarka miała szansę na render
      requestAnimationFrame(() => {
        const renderTime = performance.now();
        console.log(`[PERF] Full page ready in ${(renderTime - startTime).toFixed(2)}ms`);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); 

  if (loading) return <div className="p-10 text-slate-400 italic">Ładowanie danych...</div>;
  if (!line) notFound();

  const latestStatus = line.history[line.history.length - 1]?.status;

  return (
    <main className="h-screen bg-slate-50/30 overflow-hidden flex flex-col">
      <div className="max-w-[98%] mx-auto w-full px-6 py-4 flex flex-col h-full gap-4">
        
        {/* SHARED HEADER */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 shrink-0">
          <div>
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-1 group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Dashboard</span>
            </Link>
            <div className="flex items-center gap-4 text-left">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{line.name}</h1>
              <StatusBadge status={latestStatus} className="py-1 px-3 text-[10px]" />
            </div>
          </div>

          <div className="flex items-center gap-8 bg-white px-6 py-3 rounded-2xl border border-slate-100">
            <div className="text-center min-w-[80px]"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Scrap</p><p className="text-xl font-black text-slate-900 font-mono leading-none">{line.scrap.length}</p></div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-center min-w-[80px]"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Godzina</p><p className="text-xl font-black text-slate-900 font-mono leading-none">{format(now, 'HH:mm')}</p></div>
          </div>
        </header>

        {/* CORE DIAGNOSTICS (TIMELINE + KPI + LOG) */}
        <LineDiagnostics 
          lineId={line.id}
          initialPlans={line.plans}
          initialHistory={line.history}
          initialComments={line.comments}
          from={from.toISOString()}
          to={to.toISOString()}
        />
      </div>
    </main>
  );
}
