"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search, SearchX, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/meetings/Pagination";
import { SpeakerAvatar } from "@/components/transcript/SpeakerAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { api } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import { formatTimestamp } from "@/lib/time";
import type { SearchResults as Results } from "@/lib/types";

const PAGE_SIZE = 20;

export function SearchResults() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);

  const search = useQuery({
    queryKey: ["search", q, page],
    queryFn: () => api.get<Results>("/api/search", { q, page, limit: PAGE_SIZE }),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

  const goToPage = (next: number) => {
    const p = new URLSearchParams(params.toString());
    if (next > 1) p.set("page", String(next)); else p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  if (!hydrated) return <Skeleton className="h-40 w-full" />;
  if (!q) {
    return <EmptyState icon={Search} title="Search every conversation" description="Type in the search box above. It looks through the full text of every transcript and understands word endings, so “deploy” finds “deploying”." />;
  }
  if (search.isPending) {
    return <div className="space-y-3" role="status" aria-label="Searching">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
  }
  if (search.isError && !search.data) {
    return <EmptyState icon={TriangleAlert} title="Search failed" description={(search.error as Error).message} action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => search.refetch()}>Try again</Button>} />;
  }
  const data = search.data!;
  if (data.total === 0) {
    return <EmptyState icon={SearchX} title={`No results for “${q}”`} description="Check the spelling, or try fewer or different words. You can also put a phrase in quotes." />;
  }

  return (
    <div className={search.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <p className="mb-4 flex items-center gap-2 text-[14px] text-muted-foreground" aria-live="polite">
        {data.total} {data.total === 1 ? "result" : "results"} for “{q}” {search.isPlaceholderData && <Loader2 className="size-3.5 animate-spin" />}
      </p>
      <ul className="space-y-3">
        {data.hits.map((hit) => (
          <li key={hit.segment_id}>
            <Link
              href={`/meetings/${hit.meeting_id}?t=${hit.start_ms}`}
              className="block rounded-xl border bg-card p-4 outline-none transition-colors hover:border-ring/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
                <span className="truncate font-medium text-foreground">{hit.meeting_title}</span>
                <span className="shrink-0">{formatMeetingDateTime(hit.meeting_started_at)}</span>
              </div>
              <p className="mt-2 text-[14px] leading-6 text-foreground/85">
                {hit.snippet.map((part, i) => part.match ? <mark key={i} className="rounded bg-yellow-400/30 px-0.5 text-foreground">{part.text}</mark> : <span key={i}>{part.text}</span>)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                {hit.speaker_name && <><SpeakerAvatar name={hit.speaker_name} colorIndex={0} className="size-4 text-[8px]" /> {hit.speaker_name} ·</>}
                <span className="tabular-nums">{formatTimestamp(hit.start_ms)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} limit={PAGE_SIZE} total={data.total} onPage={goToPage} />
    </div>
  );
}
