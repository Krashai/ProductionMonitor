'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';
import type { ImportRow } from '@/lib/import-types';

interface Props {
  rows: ImportRow[];
  unknownResources: string[];
  onRowsChange: (rows: ImportRow[]) => void;
}

export function ImportPreviewTable({ rows, unknownResources, onRowsChange }: Props) {
  function handleSpeedChange(id: string, value: string) {
    const speed = parseFloat(value);
    onRowsChange(
      rows.map((r) => (r.id === id ? { ...r, plannedSpeed: isNaN(speed) ? 0 : speed } : r))
    );
  }

  const hasInvalidSpeeds = rows.some((r) => !r.plannedSpeed || r.plannedSpeed <= 0);

  return (
    <div className="space-y-4">
      {unknownResources.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
              Nierozpoznane zasoby — wiersze pominięte
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {unknownResources.join(', ')}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Brak rozpoznanych zleceń w pliku.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Linia
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Indeks
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Start
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Koniec
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Prędkość (m/min) *
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700">{row.lineName}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {row.productIndex}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {format(new Date(row.startTime), 'dd.MM HH:mm', { locale: pl })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {format(new Date(row.endTime), 'dd.MM HH:mm', { locale: pl })}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={row.plannedSpeed || ''}
                        onChange={(e) => handleSpeedChange(row.id, e.target.value)}
                        placeholder="np. 120.5"
                        className={`w-28 bg-white border rounded-xl px-3 py-1.5 text-xs font-bold outline-none transition-all ${
                          !row.plannedSpeed || row.plannedSpeed <= 0
                            ? 'border-rose-300 focus:border-rose-500 text-rose-700'
                            : 'border-slate-200 focus:border-blue-500 text-slate-900'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasInvalidSpeeds && (
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={12} />
              Wypełnij prędkość dla wszystkich zleceń przed kontynuacją.
            </p>
          )}
        </>
      )}
    </div>
  );
}
