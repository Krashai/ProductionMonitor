import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import { getAppMode } from '@/lib/settings';
import { ConfigForm } from '@/components/ConfigForm';

// Ustawienia zależą od stanu bazy — render per żądanie, bez prerenderu.
export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const mode = await getAppMode();

  return (
    <main className="min-h-screen bg-slate-50/30 px-6 py-12">
      <div className="w-full max-w-3xl mx-auto">
        {/* Nagłówek */}
        <div className="flex items-start justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
              <SlidersHorizontal className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                Konfiguracja systemu
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Ustawienia wyświetlania wallboardu linii produkcyjnych
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 mt-2">
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors group"
            >
              <LayoutGrid size={14} />
              Przegląd
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors group"
            >
              <ArrowLeft
                size={14}
                className="group-hover:-translate-x-1 transition-transform"
              />
              Monitor
            </Link>
          </div>
        </div>

        <ConfigForm initialMode={mode} />
      </div>
    </main>
  );
}
