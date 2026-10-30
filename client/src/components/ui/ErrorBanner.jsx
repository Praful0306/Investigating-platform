import { TriangleAlert } from 'lucide-react';
import { friendlyMessage, isRetryable } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

// The compact, inline cousin of <ErrorState>: sits inside a form. "Try again" only when retrying can help.
export function ErrorBanner({ error, message, onRetry, className }) {
  const text = message ?? friendlyMessage(error);
  const canRetry = Boolean(onRetry) && (error ? isRetryable(error) : true);
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-chip border border-blood/40 bg-blood/10 p-4', className)}>
      <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-blood-soft" />
      <p className="min-w-0 flex-1 text-sm text-zinc-100">{text}</p>
      {canRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
