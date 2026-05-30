'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Tailwind max-width class. Default: max-w-4xl. */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * Modal — generyczny dialog spójny ze stylem istniejących popupów
 * (LineDiagnostics / ProductionTimeline): backdrop + blur, z-[200],
 * animate-in zoom-in-95. Dodatkowo:
 *  - ESC zamyka
 *  - body scroll lock kiedy otwarty
 *  - klik w backdrop zamyka
 *  - role="dialog" + aria-modal dla a11y
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'max-w-4xl',
  children,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in zoom-in-95 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-white border border-slate-200 rounded-3xl shadow-2xl w-full overflow-hidden text-left flex flex-col max-h-[90vh]',
          maxWidth
        )}
      >
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 bg-slate-900 rounded-lg text-white">{icon}</div>
            )}
            <div>
              <h4
                id="modal-title"
                className="font-black text-slate-900 text-sm uppercase tracking-widest"
              >
                {title}
              </h4>
              {subtitle && (
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="text-slate-400 hover:text-slate-900 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
