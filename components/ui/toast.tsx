'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastVariant = 'default' | 'destructive';

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastInput = Omit<ToastItem, 'id'>;

type ToastContextValue = {
  push: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((toast: ToastInput) => {
    const id = randomId();
    setToasts((prev) => [...prev, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              toast.variant === 'destructive'
                ? 'border-red-200'
                : 'border-gray-200'
            }`}
          >
            {toast.title ? (
              <div className="text-sm font-semibold text-gray-900">
                {toast.title}
              </div>
            ) : null}
            <div
              className={`mt-1 text-sm ${
                toast.variant === 'destructive'
                  ? 'text-red-700'
                  : 'text-gray-700'
              }`}
            >
              {toast.message}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

