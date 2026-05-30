'use client';

import { useEffect, useState } from 'react';
import { Upload, Table2, CheckCircle2, Loader2, Check, AlertCircle, RotateCcw, FileText } from 'lucide-react';
import { checkAndExecuteImport } from '@/app/actions';
import { ImportPreviewTable } from './ImportPreviewTable';
import { ImportConflictView } from './ImportConflictView';
import type { ImportLine, ImportPreview, ImportRow } from '@/lib/import-types';
import { cn } from '@/lib/utils';

interface Props {
  lines: ImportLine[];
  /** Wywoływane po udanym imporcie (z opóźnieniem, gdy widać ekran sukcesu). */
  onSuccess?: () => void;
}

type Step = 'upload' | 'speeds' | 'confirm';

const STEPS: { key: Step; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: 'Wgraj plik', icon: Upload },
  { key: 'speeds', label: 'Prędkości', icon: Table2 },
  { key: 'confirm', label: 'Potwierdź', icon: CheckCircle2 },
];

const SUCCESS_AUTOCLOSE_MS = 1800;

export function ImportWizard({ lines, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [unknownResources, setUnknownResources] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const hasInvalidSpeeds = rows.some((r) => !r.plannedSpeed || r.plannedSpeed <= 0);

  async function processFile(file: File) {
    setParseError(null);
    setFileName(file.name);

    if (!file.name.match(/\.(xlsx|xlsm)$/i)) {
      setParseError('Nieobsługiwany format pliku. Wybierz plik .xlsx lub .xlsm.');
      return;
    }

    try {
      setLoading(true);
      // Dynamiczny import SheetJS (client-side only)
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

      const { parseGanttSheet, resolveRows } = await import('@/lib/xlsm-parser');
      const parsedRows = parseGanttSheet(workbook);
      const { known, unknown } = resolveRows(parsedRows, lines);

      if (known.length === 0 && unknown.length === 0) {
        setParseError('Plik nie zawiera żadnych danych w arkuszu "Gantt_dane".');
        return;
      }

      setRows(known);
      setUnknownResources(unknown);
      setStep('speeds');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nieznany błąd parsowania pliku.';
      setParseError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function handleCheckConflicts() {
    setLoading(true);
    const result = await checkAndExecuteImport(rows, false);
    setLoading(false);

    if (!result.success) {
      setParseError((result as { success: false; error: string }).error);
      return;
    }

    if ('preview' in result) {
      setPreview(result.preview);
      setStep('confirm');
    }
  }

  async function handleImport() {
    if (!preview) return;
    setLoading(true);

    const allRows = [...preview.newRows, ...preview.conflictingNew];
    const approvedConflictIds = preview.conflictingExisting.map((c) => c.id);
    const result = await checkAndExecuteImport(allRows, true, approvedConflictIds);
    setLoading(false);

    if (!result.success) {
      setParseError((result as { success: false; error: string }).error);
      return;
    }

    if ('imported' in result) {
      setImportedCount(result.imported);
      setImportDone(true);
    }
  }

  function handleReset() {
    setStep('upload');
    setFileName(null);
    setRows([]);
    setUnknownResources([]);
    setPreview(null);
    setParseError(null);
    setImportDone(false);
    setImportedCount(0);
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // Auto-close po sukcesie (gdy modal zostawia callback)
  useEffect(() => {
    if (!importDone || !onSuccess) return;
    const t = setTimeout(onSuccess, SUCCESS_AUTOCLOSE_MS);
    return () => clearTimeout(t);
  }, [importDone, onSuccess]);

  // Sukces po imporcie
  if (importDone) {
    return (
      <div className="p-10 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="text-emerald-600" size={32} />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900">Import zakończony!</h3>
          <p className="text-slate-500 text-sm mt-2">
            Pomyślnie zaimportowano {importedCount} zleceń do harmonogramu.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 mx-auto text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
        >
          <RotateCcw size={14} />
          Importuj kolejny plik
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Stepper */}
      <div className="border-b border-slate-100 px-10 py-6">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center gap-0 flex-1 last:flex-none">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all',
                      isActive && 'bg-slate-900 text-white',
                      isDone && 'bg-emerald-100 text-emerald-700',
                      !isActive && !isDone && 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {isDone ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase tracking-widest',
                      isActive ? 'text-slate-900' : 'text-slate-400'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-4', isDone ? 'bg-emerald-200' : 'bg-slate-100')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Treść kroku */}
      <div className="p-10 space-y-6">
        {parseError && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <p className="text-xs font-bold text-rose-700">{parseError}</p>
          </div>
        )}

        {/* Krok 1: Upload */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer',
              isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            )}
          >
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={handleFileInput}
                className="hidden"
              />
              {loading ? (
                <Loader2 className="animate-spin mx-auto text-slate-400" size={32} />
              ) : (
                <>
                  <Upload className="mx-auto text-slate-400 mb-4" size={32} />
                  <p className="text-sm font-bold text-slate-700">
                    Przeciągnij plik tutaj lub{' '}
                    <span className="text-blue-600 underline">kliknij aby wybrać</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Obsługiwane formaty: .xlsx, .xlsm</p>
                  {fileName && (
                    <p className="text-xs font-bold text-slate-600 mt-3 bg-white border border-slate-200 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                      <FileText size={12} className="text-slate-400" />
                      {fileName}
                    </p>
                  )}
                </>
              )}
            </label>
          </div>
        )}

        {/* Krok 2: Prędkości */}
        {step === 'speeds' && (
          <>
            <ImportPreviewTable
              rows={rows}
              unknownResources={unknownResources}
              onRowsChange={setRows}
            />
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all"
              >
                Wróć
              </button>
              <button
                onClick={handleCheckConflicts}
                disabled={loading || hasInvalidSpeeds || rows.length === 0}
                className="flex-2 flex-grow bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                Sprawdź konflikty
              </button>
            </div>
          </>
        )}

        {/* Krok 3: Potwierdzenie */}
        {step === 'confirm' && preview && (
          <>
            <ImportConflictView
              newRows={preview.newRows}
              conflictingExisting={preview.conflictingExisting}
              conflictingNew={preview.conflictingNew}
            />
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setStep('speeds')}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all"
              >
                Wróć
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-grow bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Importuj {(preview.newRows.length + preview.conflictingNew.length)} zleceń
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
