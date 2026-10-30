import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn.js';

// The bare icon: decorative, used inside buttons (the button itself announces "busy").
export function SpinnerIcon({ className }) {
  return <LoaderCircle data-spinner aria-hidden="true" className={cn('size-4 animate-spin', className)} />;
}

// A standalone loading indicator that is announced politely to screen readers.
export function Spinner({ label = 'Loading', className }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-mist', className)}>
      <SpinnerIcon className="size-5 text-amber" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
