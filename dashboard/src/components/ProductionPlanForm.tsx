'use client'

import { useState, useMemo, useRef, useEffect } from 'react';
import { addProductionPlan, updateProductionPlan, deleteProductionPlan } from '@/app/actions';
import { AlertCircle, Check, Loader2, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isWithinInterval, endOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Plan {
  id: string;
  lineId: string;
  startTime: string | Date;
  endTime: string | Date;
}

interface Line {
  id: string;
  name: string;
  hall: { name: string };
}

interface Props {
  lines: Line[];
  allPlans: Plan[];
  initialData?: {
    id: string;
    lineId: string;
    productIndex: string;
    startTime: Date;
    endTime: Date;
    plannedSpeed: number;
  };
  onSuccess?: () => void;
}

export function ProductionPlanForm({ lines, allPlans, initialData, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [lastData, setLastData] = useState<any>(null);

  // Form State
  const [selectedLineId, setSelectedLineId] = useState<string>(initialData?.lineId || '');
  const [startDT, setStartDT] = useState<Date>(initialData ? new Date(initialData.startTime) : new Date());
  const [endDT, setEndDT] = useState<Date>(initialData ? new Date(initialData.endTime) : addDays(new Date(), 0.3));

  const isEdit = !!initialData;

  // Filter plans for the currently selected line to show occupancy
  const linePlans = useMemo(() => {
    return (allPlans || []).filter(p => p.lineId === selectedLineId && p.id !== initialData?.id);
  }, [allPlans, selectedLineId, initialData]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, ignoreWarning = false) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setMessage(null);
    setWarning(null);

    const payload = {
      lineId: selectedLineId,
      productIndex: formData.get('productIndex') as string,
      plannedSpeed: parseFloat(formData.get('plannedSpeed') as string),
      startTime: startDT,
      endTime: endDT,
      ignoreWarning
    };

    if (endDT <= startDT) {
      setMessage({ type: 'error', text: 'Koniec musi być po rozpoczęciu.' });
      setLoading(false);
      return;
    }

    setLastData(payload);
    let result = isEdit ? await updateProductionPlan(initialData!.id, payload) : await addProductionPlan(payload);

    if (result.success) {
      setMessage({ type: 'success', text: isEdit ? 'Zaktualizowano.' : 'Dodano pomyślnie.' });
      if (onSuccess) setTimeout(onSuccess, 1000);
    } else if ('warning' in result && result.warning) {
      setWarning(('message' in result && result.message) || 'Kolizja w planie.');
    } else {
      setMessage({ type: 'error', text: result.error || 'Błąd.' });
    }
    setLoading(false);
  }

  return (
    <div className={cn("bg-white text-left", !isEdit && "border border-slate-200 rounded-[2.5rem] p-8 shadow-sm")}>
      <form id="plan-form" onSubmit={onSubmit} className="space-y-8 text-left">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linia Produkcyjna</label>
            <select 
              name="lineId" 
              required 
              value={selectedLineId} 
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 appearance-none transition-all"
            >
              <option value="">Wybierz linię...</option>
              {lines.map(line => (
                <option key={line.id} value={line.id}>{line.hall.name} — {line.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Indeks Produktu</label>
            <input name="productIndex" type="text" placeholder="np. INDEX-XYZ-2024" required defaultValue={initialData?.productIndex} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
          </div>

          {/* SMART PICKERS */}
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rozpoczęcie</label>
              <DateTimePicker value={startDT} onChange={setStartDT} label="Start" linePlans={linePlans} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Zakończenie</label>
              <DateTimePicker value={endDT} onChange={setEndDT} label="Koniec" highlight linePlans={linePlans} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prędkość Zadana (m/min)</label>
            <input name="plannedSpeed" type="number" step="0.1" placeholder="np. 120.5" required defaultValue={initialData?.plannedSpeed} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
          </div>
        </div>

        {message && (
          <div className={cn("p-4 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-3", 
            message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100")}>
            {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        {warning && (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl space-y-4">
            <div className="flex items-start gap-3 text-amber-800">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-xs font-bold leading-relaxed uppercase tracking-tight">{warning}</p>
            </div>
            <button 
              type="submit"
              onClick={() => { /* Handled by onSubmit with ignoreWarning */ }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-xl transition-all shadow-lg"
            >
              Ignoruj i zapisz
            </button>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading || !!warning} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : isEdit ? 'Zapisz Zmiany' : 'Zatwierdź Plan'}
          </button>
          {isEdit && (
            <button type="button" onClick={() => { if(confirm('Usunąć?')) deleteProductionPlan(initialData!.id).then(() => onSuccess?.()) }} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-5 rounded-2xl border border-rose-100"><Trash2 size={20} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function DateTimePicker({ value, onChange, label, highlight, linePlans }: { value: Date, onChange: (d: Date) => void, label: string, highlight?: boolean, linePlans: Plan[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(startOfMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  // Check if a specific day is occupied by any plan
  const isDayOccupied = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return linePlans.some(p => {
      const pStart = new Date(p.startTime);
      const pEnd = new Date(p.endTime);
      return (pStart < dayEnd && pEnd > dayStart);
    });
  };

  const updateTime = (h: number, m: number) => {
    const next = new Date(value);
    next.setHours(h, m);
    onChange(next);
  };

  const updateDate = (d: Date) => {
    const next = new Date(d);
    next.setHours(value.getHours(), value.getMinutes());
    onChange(next);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-2xl border text-sm font-bold transition-all",
          highlight ? "bg-blue-50/50 border-blue-100 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-900",
          isOpen && "ring-2 ring-blue-500/20 border-blue-500"
        )}
      >
        <span className="capitalize text-left">{format(value, 'EEEE, d MMM — HH:mm', { locale: pl })}</span>
        <CalendarIcon size={16} className={highlight ? "text-blue-400" : "text-slate-400"} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-[110] bg-white border border-slate-200 shadow-2xl rounded-3xl p-6 flex gap-6 animate-in fade-in zoom-in duration-150 origin-top-left">
          {/* Calendar */}
          <div className="w-64">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase text-slate-900">{format(viewDate, 'MMMM yyyy', { locale: pl })}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:bg-slate-100 rounded-md"><ChevronLeft size={16}/></button>
                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:bg-slate-100 rounded-md"><ChevronRight size={16}/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(d => (
                <span key={d} className="text-[9px] font-black text-slate-400 text-center uppercase">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const occupied = isDayOccupied(day);
                const isSelected = isSameDay(day, value);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateDate(day)}
                    className={cn(
                      "h-9 w-8 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center relative",
                      !isSelected && format(day, 'M') !== format(viewDate, 'M') && "text-slate-300",
                      !isSelected && format(day, 'M') === format(viewDate, 'M') && "text-slate-700 hover:bg-slate-100",
                      isSelected && "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    )}
                  >
                    <span>{format(day, 'd')}</span>
                    {occupied && (
                      <div className={cn(
                        "w-1 h-1 rounded-full absolute bottom-1.5",
                        isSelected ? "bg-white/60" : "bg-blue-500"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Grid */}
          <div className="border-l border-slate-100 pl-6 flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 mb-4 block">Godzina (24H)</span>
            <div className="grid grid-cols-2 gap-2 h-[240px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.from({ length: 24 }).map((_, h) => (
                [0, 30].map(m => (
                  <button
                    key={`${h}-${m}`}
                    type="button"
                    onClick={() => updateTime(h, m)}
                    className={cn(
                      "px-3 py-2 text-[11px] font-bold rounded-lg transition-all",
                      value.getHours() === h && value.getMinutes() === m
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}
                  </button>
                ))
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
