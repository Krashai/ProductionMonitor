'use client'

import { useState } from 'react';
import { addProductionPlan } from '@/app/actions';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Line {
  id: string;
  name: string;
  hall: { name: string };
}

interface Props {
  lines: Line[];
}

export function ProductionPlanForm({ lines }: Props) {
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [lastData, setLastData] = useState<any>(null);

  async function handleSubmit(formData: any, ignoreWarning = false) {
    setLoading(true);
    setMessage(null);
    setWarning(null);

    const lineId = formData.lineId;
    const productIndex = formData.productIndex;
    const startTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endTime = new Date(`${formData.endDate}T${formData.endTime}`);
    const plannedSpeed = parseFloat(formData.plannedSpeed);

    if (endTime <= startTime) {
      setMessage({ type: 'error', text: 'Data zakończenia musi być późniejsza niż rozpoczęcia.' });
      setLoading(false);
      return;
    }

    const payload = { lineId, productIndex, startTime, endTime, plannedSpeed, ignoreWarning };
    setLastData(payload);

    const result = await addProductionPlan(payload);

    if (result.success) {
      setMessage({ type: 'success', text: 'Zlecenie zostało pomyślnie dodane.' });
      (document.getElementById('plan-form') as HTMLFormElement).reset();
    } else if (result.warning) {
      setWarning(result.message || 'Wykryto kolizję w planie.');
    } else {
      setMessage({ type: 'error', text: result.error || 'Wystąpił błąd.' });
    }
    
    setLoading(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm text-left">
      <form id="plan-form" action={(fd) => {
        const obj: any = {};
        fd.forEach((v, k) => obj[k] = v);
        handleSubmit(obj);
      }} className="space-y-8 text-left">
        <div className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">Linia Produkcyjna</label>
            <select name="lineId" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition-all">
              <option value="">Wybierz linię...</option>
              {lines.map(line => (
                <option key={line.id} value={line.id}>{line.hall.name} — {line.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">Indeks Produktu</label>
            <input name="productIndex" type="text" placeholder="np. INDEX-XYZ-2024" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Początek (Dzień)</label>
              <input name="startDate" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Godzina Startu</label>
              <input name="startTime" type="time" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-blue-500">Koniec (Dzień)</label>
              <input name="endDate" type="date" required className="w-full bg-slate-50 border border-blue-100 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-blue-500">Godzina Końca</label>
              <input name="endTime" type="time" required className="w-full bg-slate-50 border border-blue-100 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left">Prędkość Zadana (m/min)</label>
            <input name="plannedSpeed" type="number" step="0.1" placeholder="np. 120.5" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
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
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl space-y-4 text-left">
            <div className="flex items-start gap-3 text-amber-800 text-left">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-xs font-bold leading-relaxed uppercase tracking-tight text-left">{warning}</p>
            </div>
            <button 
              type="button"
              onClick={() => handleSubmit(lastData, true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-xl transition-all shadow-lg"
            >
              Ignoruj i zapisz mimo kolizji
            </button>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || !!warning}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Zatwierdź Plan Produkcji'}
        </button>
      </form>
    </div>
  );
}
