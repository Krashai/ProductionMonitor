import { getLines } from "@/app/actions";
import { ProductionPlanForm } from "@/components/ProductionPlanForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function PlanningPage() {
  const lines = await getLines();

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-12">
      <header className="mb-12">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-6 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Wróć do monitora</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Planowanie Produkcji
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Dodaj nowe zlecenia do harmonogramu linii.</p>
      </header>

      <ProductionPlanForm lines={lines} />
    </main>
  );
}
