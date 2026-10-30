import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { ToastContext } from './useToast.js';

const MAX_VISIBLE = 3;

const TONES = {
  success: { icon: CircleCheck, style: 'border-moss/40 text-moss' },
  error: { icon: TriangleAlert, style: 'border-blood/40 text-blood-soft' },
  info: { icon: Info, style: 'border-amber/40 text-amber' },
};

// toast({ title, description?, tone?: 'success' | 'error' | 'info', duration? = 4000 }) -> id.   dismiss(id) removes one.
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ title, description, tone = 'info', duration = 4000 }) => {
    const id = `t${++counter.current}`;
    setItems((list) => {
      const next = [...list, { id, title, description, tone }];
      for (const dropped of next.slice(0, -MAX_VISIBLE)) {
        clearTimeout(timers.current.get(dropped.id));
        timers.current.delete(dropped.id);
      }
      return next.slice(-MAX_VISIBLE);
    });
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* always mounted so the first toast is announced; polite = never interrupts what a screen reader is saying */}
      <section aria-label="Notifications" aria-live="polite" className="pointer-events-none fixed inset-x-4 top-20 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        {items.map((t) => {
          const { icon: Icon, style } = TONES[t.tone] ?? TONES.info;
          return (
            <div
              key={t.id}
              data-tone={t.tone}
              className={cn('surface-felt pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 p-4', style)}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-100">{t.title}</p>
                {t.description && <p className="text-sm text-mist">{t.description}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className="-m-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-chip text-mist transition hover:text-zinc-100"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}
