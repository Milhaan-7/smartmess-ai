import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { uid } from '../../lib/ids';

type ToastTone = 'success' | 'error';
interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ notify: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = uid('toast');
      setToasts((t) => [...t, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-3.5 text-sm shadow-lg"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
            )}
            <p className="flex-1 text-gray-800">{t.message}</p>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-700">
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
