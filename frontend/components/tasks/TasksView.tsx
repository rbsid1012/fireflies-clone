"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CornerDownRight, ListChecks, Search, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/meetings/Pagination";
import { SpeakerAvatar } from "@/components/transcript/SpeakerAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TASK_PAGE_SIZE, useTasks, useToggleTask, type TaskFilters } from "@/hooks/useTasks";
import { useHydrated } from "@/hooks/useHydrated";
import { formatDay } from "@/lib/dates";
import { formatTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

const STATUSES = [["open", "Open"], ["done", "Done"], ["all", "All"]] as const;

function parse(params: URLSearchParams): TaskFilters {
  const status = params.get("status");
  return {
    status: status === "done" || status === "all" ? status : "open",
    mine: params.get("mine") === "1",
    q: (params.get("q") ?? "").slice(0, 200),
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

export function TasksView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const filters = parse(new URLSearchParams(params.toString()));
  const tasks = useTasks(filters);
  const toggle = useToggleTask();

  const update = (patch: Partial<TaskFilters>) => {
    const next = { ...filters, page: 1, ...patch };
    const p = new URLSearchParams();
    if (next.status !== "open") p.set("status", next.status);
    if (next.mine) p.set("mine", "1");
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.page > 1) p.set("page", String(next.page));
    router.push(p.size ? `${pathname}?${p}` : pathname);
  };

  if (!hydrated) return <Skeleton className="h-64 w-full" />;
  const data = tasks.data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Status" className="inline-flex rounded-lg bg-muted p-[3px]">
          {STATUSES.map(([value, label]) => (
            <button key={value} role="tab" aria-selected={filters.status === value} onClick={() => update({ status: value })}
              className={cn("h-8 rounded-md px-3.5 text-[14px] transition-colors", filters.status === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {label}{data && value !== "all" && <span className="ml-1.5 text-[12px] tabular-nums text-muted-foreground">{data.counts[value]}</span>}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[14px]">
          <Checkbox checked={filters.mine} onCheckedChange={(v) => update({ mine: v === true })} aria-label="Only tasks assigned to me" />
          Assigned to me{data && <span className="text-[12px] tabular-nums text-muted-foreground">{data.counts.mine}</span>}
        </label>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
          <input
            key={filters.q} defaultValue={filters.q} aria-label="Search tasks" placeholder="Search tasks" maxLength={200}
            onKeyDown={(e) => { if (e.key === "Enter") update({ q: e.currentTarget.value }); }}
            onBlur={(e) => e.currentTarget.value !== filters.q && update({ q: e.currentTarget.value })}
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      {data && data.counts.overdue > 0 && filters.status !== "done" && (
        <p className="text-[13px] text-destructive">{data.counts.overdue} overdue</p>
      )}

      {tasks.isPending && <div className="space-y-2.5" role="status" aria-label="Loading tasks">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)}</div>}
      {tasks.isError && !data && <EmptyState icon={TriangleAlert} title="Couldn't load your tasks" description={(tasks.error as Error).message} action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => tasks.refetch()}>Try again</Button>} />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={ListChecks} className="py-14"
          title={filters.q || filters.mine ? "No tasks match" : filters.status === "done" ? "Nothing completed yet" : "You're all caught up"}
          description={filters.q || filters.mine ? "Try removing a filter." : filters.status === "done" ? "Completed tasks show up here." : "Action items from your meetings appear here when there is something to do."}
        />
      )}

      {data && data.items.length > 0 && (
        <div className={cn("transition-opacity", tasks.isPlaceholderData && "opacity-60")}>
          <ul className="space-y-2.5">
            {data.items.map((t) => {
              const overdue = !!t.due_date && !t.is_completed && t.due_date < today;
              return (
                <li key={t.id} className="flex gap-3 rounded-xl border bg-card p-3.5">
                  <Checkbox checked={t.is_completed} onCheckedChange={(v) => toggle.mutate({ id: t.id, done: v === true })} aria-label={`Mark "${t.text}" ${t.is_completed ? "not done" : "done"}`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[14px] leading-6", t.is_completed && "text-muted-foreground line-through")}>{t.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                      <Link href={`/meetings/${t.meeting_id}`} className="max-w-[260px] truncate hover:text-foreground hover:underline">{t.meeting_title}</Link>
                      {t.assignee && <span className="inline-flex items-center gap-1.5"><SpeakerAvatar name={t.assignee.name} colorIndex={t.assignee.color_index} className="size-4 text-[8px]" />{t.assignee.name}</span>}
                      {t.due_date && <span className={cn("inline-flex items-center gap-1.5", overdue && "text-destructive")}><CalendarDays className="size-3.5" />{formatDay(t.due_date)}{overdue && " · overdue"}</span>}
                      {t.source_start_ms !== null && (
                        <Link href={`/meetings/${t.meeting_id}?t=${t.source_start_ms}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><CornerDownRight className="size-3.5" />{formatTimestamp(t.source_start_ms)}</Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} limit={TASK_PAGE_SIZE} total={data.total} onPage={(page) => update({ page })} />
        </div>
      )}
    </div>
  );
}
