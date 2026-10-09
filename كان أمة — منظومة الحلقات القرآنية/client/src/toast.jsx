import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastCtx = createContext({ push: () => {} });

export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4800);
  }, []);

  const value = useMemo(() => ({
    push,
    ok: (m) => push(m, 'ok'),
    err: (m) => push(m, 'err'),
    info: (m) => push(m, 'info')
  }), [push]);

  const icon = { ok: CheckCircle2, err: AlertTriangle, info: Info };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = icon[t.kind] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon size={18} strokeWidth={1.75} />
              <span>{t.message}</span>
              <button className="toast-x" onClick={() => setItems((p) => p.filter((i) => i.id !== t.id))} aria-label="إغلاق">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
