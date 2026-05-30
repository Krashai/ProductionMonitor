import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { loginPlanning } from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PlanningLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasError = params.error === 'invalid';

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50/30 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 shadow-sm text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="text-blue-600" size={28} />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-2">
            Planowanie Produkcji
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            Podaj hasło dostępu, aby kontynuować
          </p>

          <form action={loginPlanning} className="space-y-4">
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              placeholder="Hasło"
              aria-invalid={hasError}
              aria-describedby={hasError ? 'login-error' : undefined}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all text-center"
            />

            {hasError && (
              <p
                id="login-error"
                className="text-[10px] font-black text-rose-600 uppercase tracking-widest"
              >
                Nieprawidłowe hasło — spróbuj ponownie
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all active:scale-[0.98]"
            >
              Zaloguj
            </button>
          </form>

          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-8 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Wróć do monitora
          </Link>
        </div>
      </div>
    </main>
  );
}
