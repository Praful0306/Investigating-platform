import { cn } from '../../lib/cn.js';

// A placeholder block. Size it with classes: <Skeleton className="h-8 w-40" />. Decorative, so hidden from screen readers.
export function Skeleton({ className, ...rest }) {
  return <div aria-hidden="true" {...rest} className={cn('skeleton', className)} />;
}
