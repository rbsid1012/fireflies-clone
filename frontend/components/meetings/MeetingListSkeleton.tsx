import { Skeleton } from "@/components/ui/skeleton";

export function MeetingListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading meetings">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <Skeleton className="hidden h-6 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** The whole library page while it loads: used as the Suspense fallback and before hydration. */
export function LibraryPageSkeleton() {
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-[232px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block" />
      <section className="min-w-0 flex-1 px-4 py-5 md:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-9 w-full" />
          <MeetingListSkeleton />
        </div>
      </section>
    </div>
  );
}
