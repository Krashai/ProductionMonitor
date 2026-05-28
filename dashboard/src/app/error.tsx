'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

/**
 * Error boundary dla całego segmentu /app.
 *
 * Zastępuje wcześniejszy wzorzec `catch { return [] }` w server actions:
 * teraz błąd DB propaguje do tej karty zamiast po cichu pokazywać "brak danych".
 * Operator widzi wyraźny komunikat o awarii + przycisk retry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-50 border border-rose-100">
          <AlertTriangle size={36} className="text-rose-600" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Awaria połączenia z danymi
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Dashboard nie mógł pobrać aktualnych danych produkcji.
            Najczęstsza przyczyna to chwilowy problem z bazą lub gateway.
            <br />
            <span className="text-rose-600 font-bold">
              Wyświetlane wcześniej dane mogą być nieaktualne.
            </span>
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400">id: {error.digest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all"
        >
          <RefreshCcw size={14} />
          Spróbuj ponownie
        </button>
      </div>
    </main>
  )
}
