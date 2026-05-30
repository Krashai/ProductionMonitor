'use client';

import { useCallback, useState } from 'react';
import { FileSpreadsheet, ChevronRight } from 'lucide-react';
import { ProductionPlanForm } from './ProductionPlanForm';
import { ImportWizard } from './ImportWizard';
import { Modal } from './Modal';
import type { ImportLine } from '@/lib/import-types';

interface Line {
  id: string;
  name: string;
  hall: { name: string };
}

interface Plan {
  id: string;
  lineId: string;
  startTime: string | Date;
  endTime: string | Date;
}

interface Props {
  lines: Line[];
  allPlans: Plan[];
  importLines: ImportLine[];
}

export function PlanningTabs({ lines, allPlans, importLines }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  // Wymusza remount ImportWizard po zamknięciu modala — czysty stan przy każdym otwarciu.
  const [importInstance, setImportInstance] = useState(0);

  const openImport = useCallback(() => {
    setImportInstance((n) => n + 1);
    setImportOpen(true);
  }, []);

  // Stabilna referencja — ImportWizard używa onSuccess w useEffect/setTimeout
  // i nie chcemy resetować timera przy każdym renderze rodzica.
  const closeImport = useCallback(() => {
    setImportOpen(false);
  }, []);

  return (
    <div className="space-y-6">
      <button
        onClick={openImport}
        className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl p-5 flex items-center gap-4 transition-all group text-left"
      >
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <FileSpreadsheet className="text-blue-600" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Import z Excel
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Wgraj plik .xlsx/.xlsm z planem
          </p>
        </div>
        <ChevronRight
          size={16}
          className="text-slate-400 group-hover:translate-x-1 transition-transform shrink-0"
        />
      </button>

      <ProductionPlanForm lines={lines} allPlans={allPlans} />

      <Modal
        isOpen={importOpen}
        onClose={closeImport}
        title="Import planu z Excela"
        subtitle="3 kroki: wgranie pliku → prędkości → potwierdzenie"
        icon={<FileSpreadsheet size={20} />}
      >
        <ImportWizard
          key={importInstance}
          lines={importLines}
          onSuccess={closeImport}
        />
      </Modal>
    </div>
  );
}
