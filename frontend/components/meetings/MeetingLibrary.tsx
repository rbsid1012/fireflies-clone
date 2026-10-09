"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SearchX, TriangleAlert, Upload, Video } from "lucide-react";
import { DockedAsk } from "@/components/ask/DockedAsk";
import { EmptyState } from "@/components/common/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { useMeetings, usePeople } from "@/hooks/useLibraryData";
import { ApiError } from "@/lib/api";
import {
  PAGE_SIZE, activeFilterCount, clearFilters, filtersToParams, parseFilters, withFilters,
  type LibraryFilters,
} from "@/lib/library-filters";
import { cn } from "@/lib/utils";
import { ActiveFilters } from "./ActiveFilters";
import { LibrarySearch } from "./LibrarySearch";
import { MeetingFilters } from "./MeetingFilters";
import { MeetingList } from "./MeetingList";
import { LibraryPageSkeleton, MeetingListSkeleton } from "./MeetingListSkeleton";
import { Pagination } from "./Pagination";

export function MeetingLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const meetings = useMeetings(filters);
  const people = usePeople();
  const hydrated = useHydrated();
  const [scope, setScope] = useState<"hosted" | "shared">("hosted");
  const [searchOpen, setSearchOpen] = useState(false);

  /** Filters are written to the URL; the query follows from the URL. */
  const update = useCallback(
    (patch: Partial<LibraryFilters>, mode: "push" | "replace" = "push") => {
      const next = filtersToParams(withFilters(filters, patch));
      if (params.get("view") === "all") next.set("view", "all"); // the All Meetings highlight lives in the URL too
      const qs = next.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, params, pathname, router],
  );

  const changePage = (page: number) => {
    update({ page });
    document.querySelector("main")?.scrollTo({ top: 0 });
  };
  const clearAll = () => update(clearFilters(filters));

  const hasFilters = activeFilterCount(filters) > 0;
  const data = meetings.data;
  const dateOrdered = filters.sort === "recent" || filters.sort === "oldest";

  // First client render must match the server HTML (see useHydrated)
  if (!hydrated) return <LibraryPageSkeleton />;

  return (
    <div className="flex min-h-full">
      <section className="min-w-0 flex-1">
        <div className="flex h-[71px] items-center gap-3 border-b border-border px-5">
          <div role="group" aria-label="Whose meetings" className="inline-flex h-8 overflow-hidden rounded-md border border-border">
            {([["hosted", "Hosted by me"], ["shared", "Shared with me"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)}
                className={cn("px-[18px] text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", scope === v ? "bg-surface text-foreground" : "text-fg2 hover:bg-surface/60", v === "shared" && "border-l border-border")}>{label}</button>
            ))}
          </div>
          <span aria-hidden="true" className="hidden h-5 w-px bg-muted sm:block" />
          <MeetingFilters filters={filters} onChange={update} />
          <span className="flex-1" />
          <button type="button" aria-label="Search meetings" aria-pressed={searchOpen || !!filters.q} onClick={() => setSearchOpen((o) => !o)}
            className="grid size-8 place-items-center rounded-md border border-border text-fg2 transition-colors hover:bg-surface"><Search className="size-4" strokeWidth={1.5} /></button>
        </div>

        <div className="space-y-4 px-[25px] py-[22px]">
          {(searchOpen || filters.q) && <LibrarySearch value={filters.q} onCommit={(q) => update({ q }, "replace")} />}

          <ActiveFilters filters={filters} people={people.data} onChange={update} onClearAll={clearAll} />

          {scope === "shared" ? (
            <EmptyState
              icon={Video}
              title="Nothing has been shared with you"
              description="Sharing isn't part of this version, so every meeting here is one you added."
              action={<Button variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => setScope("hosted")}>Show my meetings</Button>}
            />
          ) : (
            <>
            {data && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground" aria-live="polite">
                {data.total} {data.total === 1 ? "meeting" : "meetings"}
                {meetings.isPlaceholderData && <Loader2 className="size-3 animate-spin" aria-label="Updating" />}
              </p>
            )}

            {meetings.isPending && <MeetingListSkeleton />}

            {meetings.isError && !data && (
              <EmptyState
                icon={TriangleAlert}
                title="Couldn't load your meetings"
                description={meetings.error instanceof ApiError ? meetings.error.message : "Something went wrong."}
                action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => meetings.refetch()}>Try again</Button>}
              />
            )}

            {data && data.total === 0 && !hasFilters && (
              <EmptyState
                icon={Video}
                title={filters.source === "upload" ? "No uploads yet" : "No meetings yet"}
                description="Upload a transcript or paste one in and it will show up here with a summary and action items."
                action={
                  <Link href="/upload" className={cn(buttonVariants({ size: "lg" }), "h-9 gap-2 px-3.5 text-[14px]")}>
                    <Upload className="size-4" /> Add a meeting
                  </Link>
                }
              />
            )}

            {data && data.total === 0 && hasFilters && (
              <EmptyState
                icon={SearchX}
                title="No meetings match these filters"
                description="Try a different search, or remove some filters."
                action={<Button variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={clearAll}>Clear filters</Button>}
              />
            )}

            {data && data.total > 0 && data.items.length === 0 && (
              <EmptyState
                icon={SearchX}
                title="That page is empty"
                description={`There are only ${data.total} ${data.total === 1 ? "meeting" : "meetings"} here.`}
                action={<Button variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => changePage(1)}>Back to the first page</Button>}
              />
            )}

            {data && data.items.length > 0 && (
              <div className={cn("transition-opacity", meetings.isPlaceholderData && "opacity-60")}>
                <MeetingList items={data.items} grouped={dateOrdered} />
                <Pagination page={data.page} limit={PAGE_SIZE} total={data.total} onPage={changePage} />
                {data.page * PAGE_SIZE >= data.total && (
                  <p className="py-10 text-center text-[14px] text-muted-foreground">You&apos;ve reached the end of your meetings.</p>
                )}
              </div>
            )}
            </>
          )}
        </div>
      </section>

      <DockedAsk scopeLabel="My Meetings" />
    </div>
  );
}
