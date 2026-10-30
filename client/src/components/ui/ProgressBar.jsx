import { cn } from '../../lib/cn.js';

// Fills by scaling a full-width bar (transform only, so it animates without layout work).
export function ProgressBar({ value, max, label, className }) {
  const top = Number.isFinite(max) && max > 0 ? max : 0;
  const now = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), top);
  const ratio = top > 0 ? now / top : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuenow={now}
      className={cn('h-2 overflow-hidden rounded-full bg-white/10', className)}
    >
      <div
        data-fill
        className="h-full origin-left rounded-full bg-amber transition-transform duration-500 ease-out-expo"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
