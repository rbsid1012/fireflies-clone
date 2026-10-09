"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { BarChart3, Lightbulb, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { speakerColorClass } from "@/components/transcript/SpeakerAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import { tagDotClass } from "@/lib/tag-colors";
import type { Analytics } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [[30, "30 days"], [90, "90 days"], [365, "1 year"]] as const;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] font-medium leading-8 tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <h2 className="mb-4 text-[15px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

function WeeklyChart({ weekly, metric = "meetings" }: { weekly: Analytics["weekly"]; metric?: "meetings" | "duration" }) {
  const value = (w: Analytics["weekly"][number]) => (metric === "meetings" ? w.meetings : w.duration_ms);
  const max = Math.max(1, ...weekly.map(value));
  return (
    <div>
      <div className="flex h-40 items-end gap-2" role="list" aria-label="Meetings per week">
        {weekly.map((w) => (
          <div key={w.week_start} role="listitem" className="group flex h-full flex-1 flex-col justify-end" aria-label={`Week of ${formatDay(w.week_start)}: ${w.meetings} meetings, ${formatDuration(w.duration_ms)}`}>
            <span className="mb-1 text-center text-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{metric === "meetings" ? w.meetings : formatDuration(w.duration_ms)}</span>
            <div className={cn("w-full rounded-t-md transition-colors", value(w) ? (metric === "meetings" ? "bg-primary group-hover:bg-primary/80" : "bg-[#2dbf9b] group-hover:bg-[#2dbf9b]/80") : "bg-muted")} style={{ height: `${Math.max(value(w) ? 6 : 2, (value(w) / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{formatDay(weekly[0].week_start)}</span><span>This week</span></div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="relative grid size-28 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--muted) 0)` }} role="img" aria-label={`${pct}% of action items completed`}>
      <div className="grid size-[88px] place-items-center rounded-full bg-card text-[22px] font-medium tabular-nums">{pct}%</div>
    </div>
  );
}

export function AnalyticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const days = ([30, 90, 365] as number[]).includes(Number(params.get("days"))) ? Number(params.get("days")) : 90;
  const query = useQuery({ queryKey: ["analytics", days], queryFn: () => api.get<Analytics>("/api/analytics", { days }), placeholderData: keepPreviousData });

  if (!hydrated || query.isPending) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading analytics">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }
  if (query.isError && !query.data) {
    return <EmptyState icon={TriangleAlert} title="Couldn't load analytics" description={(query.error as Error).message} action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => query.refetch()}>Try again</Button>} />;
  }
  const d = query.data!;
  const range = (
    <div role="group" aria-label="Time range" className="inline-flex rounded-lg bg-muted p-[3px]">
      {RANGES.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={days === value} onClick={() => router.push(value === 90 ? pathname : `${pathname}?days=${value}`)}
          className={cn("h-8 rounded-md px-3.5 text-[14px] transition-colors", days === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
      ))}
    </div>
  );
  if (d.totals.meetings === 0) {
    return (
      <>
        <div className="mb-6">{range}</div>
        <EmptyState icon={BarChart3} title="No meetings in this period" description="Add a meeting, or choose a longer range." />
      </>
    );
  }
  const maxTalk = d.talk_time[0]?.share || 1;
  const maxKeyword = d.keywords[0]?.count || 1;
  const maxTag = d.tags[0]?.count || 1;

  const busiest = d.weekly.reduce((best, w) => (w.meetings > best.meetings ? w : best), d.weekly[0]);
  const insight = `You were in ${d.totals.meetings} meeting${d.totals.meetings === 1 ? "" : "s"} (${formatDuration(d.totals.total_duration_ms)}) in this period${busiest.meetings ? `, busiest the week of ${formatDay(busiest.week_start)} with ${busiest.meetings}` : ""}. ${d.totals.action_items_total ? `${Math.round(d.totals.completion_rate * 100)}% of ${d.totals.action_items_total} action items are done.` : ""}`;

  return (
    <div className={cn("space-y-5 transition-opacity", query.isPlaceholderData && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Analytics sections" className="inline-flex rounded-lg bg-muted p-[3px]">
          <span role="tab" aria-selected="true" className="rounded-md bg-seg px-4 py-1.5 text-[15px]">Meetings</span>
          <span role="tab" aria-selected="false" aria-disabled="true" title="Teams are not part of this version" className="cursor-not-allowed rounded-md px-4 py-1.5 text-[15px] text-muted-foreground/60">Team</span>
        </div>
        {range}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Meetings per week"><WeeklyChart weekly={d.weekly} /></Card>
        <Card title="Time in meetings per week"><WeeklyChart weekly={d.weekly} metric="duration" /></Card>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 text-[14px] leading-6">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-sky-300" strokeWidth={1.6} />
        <p>{insight}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Meetings" value={String(d.totals.meetings)} note={`${d.totals.people} people`} />
        <Stat label="Time in meetings" value={formatDuration(d.totals.total_duration_ms)} />
        <Stat label="Average length" value={formatDuration(d.totals.avg_duration_ms)} />
        <Stat label="Action items" value={String(d.totals.action_items_total)} note={`${d.totals.action_items_done} completed`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title="Action item completion" className="flex flex-col items-center justify-center">
          <Ring value={d.totals.completion_rate} />
          <p className="mt-3 text-[13px] text-muted-foreground">{d.totals.action_items_done} of {d.totals.action_items_total} done</p>
        </Card>
        <Card title="Who talks the most">
          <ul className="space-y-3">
            {d.talk_time.map((t, i) => (
              <li key={t.person_id}>
                <div className="mb-1 flex justify-between text-[13px]"><span>{t.name}</span><span className="tabular-nums text-muted-foreground">{Math.round(t.share * 100)}% · {formatDuration(t.ms)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", speakerColorClass(i))} style={{ width: `${(t.share / maxTalk) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Top topics">
          {d.keywords.length === 0 ? <p className="text-[14px] text-muted-foreground">No topics yet.</p> : (
            <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {d.keywords.map((k) => (
                <li key={k.keyword} className="text-foreground/85" style={{ fontSize: `${13 + (k.count / maxKeyword) * 11}px` }} title={`${k.count} meeting${k.count === 1 ? "" : "s"}`}>{k.keyword}</li>
              ))}
            </ul>
          )}
        </Card>
        {d.tags.length > 0 && (
          <Card title="Meetings by channel">
            <ul className="space-y-2.5">
              {d.tags.map((t) => (
                <li key={t.name} className="flex items-center gap-3 text-[13px]">
                  <span className="flex w-32 shrink-0 items-center gap-2"><span className={cn("size-2 rounded-full", tagDotClass(t.color))} />{t.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary/70" style={{ width: `${(t.count / maxTag) * 100}%` }} /></div>
                  <span className="w-6 text-right tabular-nums text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
