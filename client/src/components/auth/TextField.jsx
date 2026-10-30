import { useId } from 'react';
import { cn } from '../../lib/cn.js';

export const inputClass =
  'w-full rounded-chip border bg-white/[0.03] px-4 py-3 text-zinc-100 transition duration-200 placeholder:text-mist/60 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-60';

// A labelled input. The label is always visible (never just a placeholder); a hint and an error sit right under the
// field and are tied to it with aria-describedby, and the error also flips aria-invalid.
// `children` render inside the field box after the input (the password field puts its toggle there).
export function TextField({ label, error, hint, className, inputClassName, children, ...input }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-200">{label}</label>
      <div className="relative mt-1.5">
        <input
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...input}
          className={cn(inputClass, error ? 'border-blood/70' : 'border-edge hover:border-white/20', inputClassName)}
        />
        {children}
      </div>
      {hint && <p id={hintId} className="mt-1.5 text-xs text-mist">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-blood-soft">{error}</p>}
    </div>
  );
}
