import { TriangleAlert } from 'lucide-react';
import { friendlyMessage, isRetryable } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

// A calm error panel. Pass `error` (from the API layer) or an explicit `message`. "Try again" appears only when
// `onRetry` is given AND retrying could plausibly help (a FORBIDDEN case will not fix itself).
export function ErrorState({ error, message, title = 'Something went wrong', onRetry, actions, className }) {
  const text = message ?? friendlyMessage(error);
  const canRetry = Boolean(onRetry) && (error ? isRetryable(error) : true);
  return (
    <div role="alert" className={cn('surface-felt mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full border border-blood/30 bg-blood/10 text-blood-soft">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-mist">{text}</p>
      {(canRetry || actions) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {canRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
          {actions}
        </div>
      )}
    </div>
  );
}
