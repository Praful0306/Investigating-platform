import { Skeleton } from '../ui/Skeleton.jsx';

// The shape of the finished page (header, story, three suspects, a clue grid), so nothing jumps when the case arrives.
export function InvestigationSkeleton() {
  return (
    <div role="status" aria-label="Loading case" className="mx-auto max-w-6xl px-4 pb-20 pt-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-14 w-3/4 max-w-xl" />
      <Skeleton className="mt-3 h-5 w-1/2 max-w-sm" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <div className="grid grid-cols-2 content-start gap-4">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    </div>
  );
}
