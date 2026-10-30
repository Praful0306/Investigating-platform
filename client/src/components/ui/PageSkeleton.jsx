import { Skeleton } from './Skeleton.jsx';

// Shown while a lazy page chunk loads. Keeps the layout stable so nothing jumps when the real page arrives.
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="mx-auto max-w-6xl px-4 py-16">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-5 h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-lg" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
