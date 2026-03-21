'use client'

import { useState, useRef, useMemo, useEffect } from 'react';
import { format, addDays, startOfDay, differenceInMinutes, addMinutes, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProductionPlanForm } from './ProductionPlanForm';
import { updateProductionPlan } from '@/app/actions';
import { Loader2, X, Search, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Plan {
  id: string;
  lineId: string;
  productIndex: string;
  startTime: string | Date;
  endTime: string | Date;
  plannedSpeed: number;
}

interface Line {
  id: string;
  name: string;
  hallId: string;
  hall: { name: string };
}

interface Hall {
  id: string;
  name: string;
}

interface Props {
  lines: Line[];
  initialPlans: Plan[];
  halls: Hall[];
}

export function GanttChart({ lines, initialPlans, halls }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // States for filtering and UI
  const [activeHallId, setActiveHallId] = useState<string>(halls[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomDays, setZoomDays] = useState<3 | 7 | 14>(14);
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  
  const startDate = useMemo(() => startOfDay(new Date()), []);

  // Monitor container width for dynamic scaling (Fit-to-Width)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // 192px is the width of the sidebar (w-48)
        setContainerWidth(entry.contentRect.width - 192);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Dynamic HOUR_WIDTH based on available space and zoom level
  const HOUR_WIDTH = useMemo(() => {
    if (containerWidth <= 0) return 40; 
    return containerWidth / (zoomDays * 24);
  }, [containerWidth, zoomDays]);

  const ROW_HEIGHT = 70;
  const totalWidth = containerWidth;

  // Filtering Logic
  const filteredLines = useMemo(() => {
    return lines.filter(line => {
      const matchesHall = line.hallId === activeHallId;
      const matchesSearch = line.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plans.some(p => p.lineId === line.id && p.productIndex.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesHall && matchesSearch;
    });
  }, [lines, activeHallId, searchQuery, plans]);

  const filteredPlans = useMemo(() => {
    return plans.filter(plan => 
      filteredLines.some(line => line.id === plan.lineId)
    );
  }, [plans, filteredLines]);

  // Dynamic coordinate calculations
  const getX = (date: Date) => {
    const diff = differenceInMinutes(date, startDate);
    return (diff / 60) * HOUR_WIDTH;
  };

  const getDate = (x: number) => {
    const minutes = (x / HOUR_WIDTH) * 60;
    const roundedMinutes = Math.round(minutes / 15) * 15;
    return addMinutes(startDate, roundedMinutes);
  };

  const checkCollision = (planId: string, lineId: string, start: Date, end: Date) => {
    return plans.some(p => {
      if (p.id === planId || p.lineId !== lineId) return false;
      const pStart = new Date(p.startTime);
      const pEnd = new Date(p.endTime);
      return (start < pEnd && end > pStart);
    });
  };

  const handleUpdate = async (id: string, start: Date, end: Date) => {
    setLoading(true);
    const result = await updateProductionPlan(id, { startTime: start, endTime: end });
    if (result.success) {
      setPlans(prev => prev.map(p => p.id === id ? { ...p, startTime: start, endTime: end } : p));
      router.refresh();
    } else {
      alert(result.error || 'Błąd aktualizacji');
      setPlans([...plans]); 
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl">
          {halls.map(hall => (
            <button
              key={hall.id}
              onClick={() => setActiveHallId(hall.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                activeHallId === hall.id 
                  ? "bg-slate-50 text-blue-600" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
              )}
            >
              {hall.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Szukaj linii lub indeksu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl">
            {[3, 7, 14].map(days => (
              <button
                key={days}
                onClick={() => setZoomDays(days as any)}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                  zoomDays === days 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {days} dni
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GANTT CONTAINER */}
      <div ref={containerRef} className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-900" size={32} />
          </div>
        )}

        {/* HEADER: Timeline */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-30">
          <div className="w-48 shrink-0 border-r border-slate-200 bg-white p-6 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Linia / Czas</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div style={{ width: totalWidth }} className="flex">
              {Array.from({ length: zoomDays }).map((_, i) => {
                const day = addDays(startDate, i);
                return (
                  <div key={i} style={{ width: 24 * HOUR_WIDTH }} className="border-r border-slate-200/50 shrink-0">
                    <div className={cn(
                      "p-3 border-b border-slate-100 text-center bg-white",
                      isSameDay(day, new Date()) && "bg-blue-50/30"
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold uppercase truncate block",
                        isSameDay(day, new Date()) ? "text-blue-600" : "text-slate-900"
                      )}>
                        {zoomDays === 14 ? format(day, 'dd.MM') : format(day, 'EEEE, d MMM', { locale: pl })}
                      </span>
                    </div>
                    <div className="flex">
                      {Array.from({ length: 24 }).map((_, h) => {
                        const showHour = zoomDays === 3 || (zoomDays === 7 && h % 3 === 0) || (zoomDays === 14 && h % 6 === 0);
                        return (
                          <div key={h} style={{ width: HOUR_WIDTH }} className="h-8 flex items-center justify-center border-r border-slate-100/30">
                            {showHour && <span className="text-[8px] font-medium text-slate-400">{h}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-y-auto overflow-x-hidden max-h-[600px]">
          <div className="w-48 shrink-0 border-r border-slate-200 bg-white sticky left-0 z-20">
            {filteredLines.map(line => (
              <div key={line.id} style={{ height: ROW_HEIGHT }} className="border-b border-slate-100 p-4 flex flex-col justify-center bg-white">
                <span className="text-sm font-bold text-slate-900 leading-tight truncate">{line.name}</span>
              </div>
            ))}
            {filteredLines.length === 0 && (
              <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest italic">
                Brak wyników
              </div>
            )}
          </div>

          <div className="flex-1 relative bg-slate-50/10" style={{ width: totalWidth }}>
            <div className="absolute inset-0 pointer-events-none flex">
              {Array.from({ length: zoomDays * 24 }).map((_, i) => (
                <div key={i} style={{ width: HOUR_WIDTH }} className="h-full border-r border-slate-100/30" />
              ))}
            </div>

            {filteredLines.map((line) => (
              <div 
                key={line.id} 
                style={{ height: ROW_HEIGHT, width: totalWidth }} 
                className="border-b border-slate-100 relative group/row hover:bg-white transition-colors"
              >
                {plans
                  .filter(p => p.lineId === line.id)
                  .map(plan => (
                    <GanttBar 
                      key={plan.id}
                      plan={plan}
                      getX={getX}
                      getDate={getDate}
                      onEdit={() => setEditingPlan(plan)}
                      onUpdate={handleUpdate}
                      checkCollision={checkCollision}
                      HOUR_WIDTH={HOUR_WIDTH}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DETAIL TABLE */}
      <section className="mt-12 bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm text-left">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-left">
          <h2 className="text-lg font-bold text-slate-900 text-left">Lista Zleceń: {halls.find(h => h.id === activeHallId)?.name}</h2>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredPlans.length} wpisów</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30 border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Linia</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Indeks Produktu</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Start</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Koniec</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Prędkość</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPlans.map(plan => {
                const line = lines.find(l => l.id === plan.lineId);
                return (
                  <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4 text-sm font-bold text-slate-900">{line?.name}</td>
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{plan.productIndex}</span>
                    </td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{format(new Date(plan.startTime), 'dd.MM HH:mm')}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{format(new Date(plan.endTime), 'dd.MM HH:mm')}</td>
                    <td className="px-8 py-4 text-sm font-black text-slate-900 text-right">{plan.plannedSpeed} m/min</td>
                    <td className="px-8 py-4 text-center text-left">
                      <button 
                        onClick={() => setEditingPlan(plan)}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic text-sm">
                    Brak zaplanowanych zleceń dla wybranych filtrów.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* EDIT MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-left">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setEditingPlan(null)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 text-left">
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 text-left">Edytuj Zlecenie</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 text-left">Indeks: {editingPlan.productIndex}</p>
              </div>
              <button onClick={() => setEditingPlan(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-10 max-h-[80vh] overflow-y-auto text-left">
              <ProductionPlanForm 
                lines={lines} 
                initialData={{
                  ...editingPlan,
                  id: editingPlan.id,
                  startTime: new Date(editingPlan.startTime),
                  endTime: new Date(editingPlan.endTime)
                }}
                onSuccess={() => {
                  setEditingPlan(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GanttBar({ plan, getX, getDate, onEdit, onUpdate, checkCollision, HOUR_WIDTH }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const initialLeft = getX(new Date(plan.startTime));
  const initialWidth = getX(new Date(plan.endTime)) - initialLeft;
  
  const [tempPos, setTempPos] = useState({ left: initialLeft, width: initialWidth });
  const startX = useRef(0);
  const originalPos = useRef(tempPos);

  const startDrag = (e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    startX.current = e.clientX;
    originalPos.current = { ...tempPos };
  };

  const startResize = (e: any) => {
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    originalPos.current = { ...tempPos };
  };

  const handleMouseMove = (e: any) => {
    if (isDragging) {
      const delta = e.clientX - startX.current;
      setTempPos(prev => ({ ...prev, left: originalPos.current.left + delta }));
    } else if (isResizing) {
      const delta = e.clientX - startX.current;
      const minWidth = 5;
      setTempPos(prev => ({ ...prev, width: Math.max(minWidth, originalPos.current.width + delta) }));
    }
  };

  const handleMouseUp = () => {
    if (!isDragging && !isResizing) return;

    const newStart = getDate(tempPos.left);
    const newEnd = isDragging 
      ? addMinutes(newStart, (originalPos.current.width / HOUR_WIDTH) * 60) 
      : getDate(tempPos.left + tempPos.width);

    if (checkCollision(plan.id, plan.lineId, newStart, newEnd)) {
      setTempPos(originalPos.current);
    } else {
      onUpdate(plan.id, newStart, newEnd);
    }

    setIsDragging(false);
    setIsResizing(false);
  };

  // Keep internal state in sync with external props/zoom changes
  useEffect(() => {
    setTempPos({ 
      left: getX(new Date(plan.startTime)), 
      width: getX(new Date(plan.endTime)) - getX(new Date(plan.startTime)) 
    });
  }, [plan.startTime, plan.endTime, HOUR_WIDTH]);

  return (
    <>
      {(isDragging || isResizing) && (
        <div className="fixed inset-0 z-[60] cursor-grabbing" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} />
      )}
      <div
        style={{ left: tempPos.left, width: tempPos.width, top: 10, height: 50 }}
        title={`${plan.productIndex} (${format(new Date(plan.startTime), 'HH:mm')} - ${format(new Date(plan.endTime), 'HH:mm')})`}
        className={cn(
          "absolute z-10 rounded-xl p-2 flex flex-col justify-center transition-shadow cursor-grab active:cursor-grabbing group/bar overflow-hidden select-none border border-black/5",
          isDragging || isResizing ? "bg-blue-500 shadow-2xl z-50 scale-[1.02] border-blue-400" : "bg-blue-600 shadow-sm hover:shadow-md"
        )}
        onMouseDown={startDrag}
      >
        <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter truncate leading-none mb-0.5">
          {format(new Date(plan.startTime), 'HH:mm')}
        </span>
        <span className="text-[10px] font-bold text-white truncate leading-none">{plan.productIndex}</span>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute right-1 top-1 opacity-0 group-hover/bar:opacity-100 bg-white/20 hover:bg-white/30 text-white p-1 rounded-md transition-all"
        >
          <Info size={10} />
        </button>

        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20 transition-colors" onMouseDown={startResize} />
      </div>
    </>
  );
}
