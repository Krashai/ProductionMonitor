import { getLines, getAllProductionPlans, getHalls } from "@/app/actions";
import { ProductionPlanForm } from "@/components/ProductionPlanForm";
import { GanttChart } from "@/components/GanttChart";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { startOfDay, addDays } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
  const lines = await getLines();
  const halls = await getHalls();

  const from = startOfDay(new Date());
  const to = addDays(from, 14);
  const plans = await getAllProductionPlans(from, to);

  return (
    <main className="min-h-screen max-w-[1800px] mx-auto px-8 py-12 text-left bg-slate-50/30">
      <header className="mb-12">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Wróć do monitora</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start">
        <div className="xl:col-span-1 space-y-8">
          <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-8 flex items-center justify-between">
              <span>Nowe Zlecenie</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">PRO</span>
            </h2>
            <ProductionPlanForm lines={lines} allPlans={plans} />
          </section>
        </div>

        <div className="xl:col-span-3">
          <GanttChart lines={lines} initialPlans={plans} halls={halls} />
        </div>
      </div>
    </main>
  );
}
