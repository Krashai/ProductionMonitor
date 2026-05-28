import {
  getLines,
  getAllProductionPlans,
  getHalls,
  getImportLines,
} from "@/app/actions";
import { PlanningTabs } from "@/components/PlanningTabs";
import { GanttChart } from "@/components/GanttChart";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { startOfDay, addDays } from "date-fns";
import { logoutPlanning } from "./login/actions";

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
  const from = startOfDay(new Date());
  const to = addDays(from, 14);

  const [lines, halls, plans, importLines] = await Promise.all([
    getLines(),
    getHalls(),
    getAllProductionPlans(from, to),
    getImportLines(),
  ]);

  return (
    <main className="min-h-screen max-w-[1800px] mx-auto px-8 py-12 text-left bg-slate-50/30">
      <header className="mb-12 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Wróć do monitora</span>
        </Link>
        <form action={logoutPlanning}>
          <button
            type="submit"
            className="flex items-center gap-2 text-slate-400 hover:text-rose-600 transition-colors group"
          >
            <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Wyloguj</span>
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start">
        <div className="xl:col-span-1 space-y-8">
          <PlanningTabs lines={lines} allPlans={plans} importLines={importLines} />
        </div>

        <div className="xl:col-span-3">
          <GanttChart lines={lines} initialPlans={plans} halls={halls} />
        </div>
      </div>
    </main>
  );
}
