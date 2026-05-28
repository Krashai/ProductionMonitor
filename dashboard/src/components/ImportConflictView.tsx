'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ImportConflict, ImportRow } from '@/lib/import-types';

interface Props {
  newRows: ImportRow[];
  conflictingExisting: ImportConflict[];
  conflictingNew: ImportRow[];
}

export function ImportConflictView({ newRows, conflictingExisting, conflictingNew }: Props) {
  const totalToImport = newRows.length + conflictingNew.length;
  const hasConflicts = conflictingExisting.length > 0;

  return (
    <div className="space-y-6">
      {/* Podsumowanie */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-700">{newRows.length}</p>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
            Nowych zleceń
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-amber-700">{conflictingNew.length}</p>
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">
            Zastępuje istniejące
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-rose-700">{conflictingExisting.length}</p>
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-1">
            Do usunięcia z bazy
          </p>
        </div>
      </div>

      {/* Nowe zlecenia */}
      {newRows.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
              Nowe zlecenia ({newRows.length})
            </h3>
          </div>
          <div className="rounded-2xl border border-emerald-100 overflow-hidden">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-emerald-50">
                {newRows.map((row) => (
                  <tr key={row.id} className="bg-emerald-50/50">
                    <td className="px-4 py-2.5 font-bold text-slate-700 w-1/3">{row.lineName}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{row.productIndex}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-right">
                      {format(new Date(row.startTime), 'dd.MM HH:mm', { locale: pl })} →{' '}
                      {format(new Date(row.endTime), 'dd.MM HH:mm', { locale: pl })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Kolidujące — do zastąpienia */}
      {hasConflicts && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-600" />
            <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
              Istniejące plany do usunięcia ({conflictingExisting.length})
            </h3>
          </div>
          <div className="rounded-2xl border border-amber-200 overflow-hidden">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-amber-50">
                {conflictingExisting.map((plan) => (
                  <tr key={plan.id} className="bg-amber-50/50">
                    <td className="px-4 py-2.5 font-bold text-slate-700 w-1/3">{plan.lineName}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900 line-through opacity-60">
                      {plan.productIndex}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-right">
                      {format(new Date(plan.startTime), 'dd.MM HH:mm', { locale: pl })} →{' '}
                      {format(new Date(plan.endTime), 'dd.MM HH:mm', { locale: pl })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conflictingNew.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                  Nowe zlecenia zastępujące ({conflictingNew.length})
                </p>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-amber-50">
                  {conflictingNew.map((row) => (
                    <tr key={row.id} className="bg-white">
                      <td className="px-4 py-2.5 font-bold text-slate-700 w-1/3">{row.lineName}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{row.productIndex}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-right">
                        {format(new Date(row.startTime), 'dd.MM HH:mm', { locale: pl })} →{' '}
                        {format(new Date(row.endTime), 'dd.MM HH:mm', { locale: pl })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
        Łącznie zostanie zaimportowanych: {totalToImport} zleceń
      </p>
    </div>
  );
}
