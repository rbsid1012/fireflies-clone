"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarCheck, CalendarClock, CalendarCog, ChevronRight, Code2, Info, Layers, ListChecks, Newspaper, Rss, Settings, Sparkles, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DockedAsk } from "@/components/ask/DockedAsk";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { api } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { MeetingListItem, Page, Tasks } from "@/lib/types";
import { cn } from "@/lib/utils";

type FeedTab = "recent" | "upcoming" | "feed";

function greeting(now = new Date()): { word: string; emoji: string } {
  const h = now.getHours();
  if (h < 12) return { word: "Good Morning", emoji: "🌤️" };
  if (h < 18) return { word: "Good Afternoon", emoji: "☀️" };
  return { word: "Good Evening", emoji: "🌙" };
}

function AssistantCard({ href, icon: Icon, tile, title, text }: { href?: string; icon: typeof Newspaper; tile: string; title: string; text: string }) {
  const body = (
    <>
      <span className={cn("grid size-8 place-items-center rounded-md text-white", tile)}><Icon className="size-4" strokeWidth={1.8} /></span>
      <p className="mt-[15px] text-[14px] leading-5 text-foreground">{title}</p>
      <p className="mt-1 text-[14px] leading-5 text-fg3">{text}</p>
    </>
  );
  const cls = "block h-[122px] rounded-lg border border-border bg-card/60 p-4 transition-colors";
  return href ? <Link href={href} className={cn(cls, "hover:bg-surface")}>{body}</Link> : <div className={cls}>{body}</div>;
}

function MeetingRow({ m, host }: { m: MeetingListItem; host: string }) {
  return (
    <li>
      <Link href={`/meetings/${m.id}`} className="flex items-center gap-3.5 rounded-lg px-3 py-3 transition-colors hover:bg-surface">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand text-[14px] text-white">{host.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[14px] text-foreground"><span className="truncate">{m.title}</span>{m.source === "upload" && <Upload className="size-3.5 shrink-0 text-fg3" strokeWidth={1.5} />}</span>
          <span className="block text-[13px] text-fg3">{formatMeetingDateTime(m.started_at)}</span>
        </span>
        {m.action_items_open > 0 && <span className="shrink-0 text-[12px] text-fg3">{m.action_items_open} open</span>}
      </Link>
    </li>
  );
}

function CaughtUp() {
  return <div className="mt-4 flex justify-center"><span className="rounded-[4px] bg-iris-chip px-2 py-0.5 text-[12px] text-iris">All caught up!</span></div>;
}

function Feed({ tab }: { tab: FeedTab }) {
  const { user } = useAuth();
  const recent = useQuery({ queryKey: ["meetings", "home"], queryFn: () => api.get<Page<MeetingListItem>>("/api/meetings", { limit: 5 }) });
  const open = useQuery({ queryKey: ["tasks", "home"], queryFn: () => api.get<Tasks>("/api/tasks", { status: "open", limit: 6 }), enabled: tab === "feed" });
  const hostOf = (m: MeetingListItem) => (m.source === "seed" ? m.participants[0]?.name : user?.name) ?? user?.name ?? "?";

  if (tab === "upcoming") {
    return (
      <div className="flex items-center gap-4 px-4 py-8 text-muted-foreground">
        <CalendarClock className="size-6 shrink-0" strokeWidth={1.4} />
        <p className="text-[14px]">No upcoming meetings. This app works from transcripts you add after a meeting, and there is no calendar connection.</p>
      </div>
    );
  }
  if (tab === "feed") {
    if (open.isPending) return <Skeleton className="m-4 h-24" />;
    const items = open.data?.items ?? [];
    return items.length === 0 ? <CaughtUp /> : (
      <ul>
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/meetings/${t.meeting_id}`} className="flex items-start gap-3.5 rounded-xl px-4 py-3 transition-colors hover:bg-accent/50">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-iris-soft" strokeWidth={1.6} />
              <span className="min-w-0"><span className="block text-[14px]">{t.text}</span><span className="block text-[12px] text-muted-foreground">{t.meeting_title}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  if (recent.isPending) return <div className="space-y-2 p-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  const items = recent.data?.items ?? [];
  return items.length === 0 ? (
    <div className="px-4 py-8 text-[14px] text-muted-foreground">No meetings yet. <Link href="/upload" className="text-foreground underline underline-offset-4">Add your first one</Link>.</div>
  ) : (
    <>
      <ul>{items.map((m) => <MeetingRow key={m.id} m={m} host={hostOf(m)} />)}</ul>
      {(recent.data?.total ?? 0) > items.length && <Link href="/meetings" className="mx-4 mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">View all {recent.data?.total} meetings <ChevronRight className="size-3.5" /></Link>}
      <CaughtUp />
    </>
  );
}

const MORE = [
  { href: "/analytics", icon: BarChart3, title: "Analytics", text: "Talk time, weekly activity and the topics that come up most." },
  { href: "/ai-skills", icon: Sparkles, title: "AI Skills", text: "One-click prompts: decisions, risks, follow-ups, prep notes." },
  { href: "/integrations", icon: Layers, title: "Integrations", text: "Post recaps to Slack or any signed webhook." },
  { href: "/settings/api", icon: Code2, title: "API & MCP", text: "Use your meetings from scripts with a personal API key." },
] as const;

export function HomePage() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<FeedTab>("recent");
  const tasks = useQuery({ queryKey: ["tasks", "home-count"], queryFn: () => api.get<Tasks>("/api/tasks", { status: "open", limit: 1 }) });
  const { word, emoji } = greeting();
  const first = (user?.name.split(" ")[0] ?? "").toUpperCase();
  const openTasks = tasks.data?.counts.open;

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 bg-gradient-to-b from-primary/5 via-background to-background dark:from-[#1c2030]/70">
        <div className="mx-auto w-full max-w-[684px] px-4 pb-16 pt-10 md:px-0">
          <h1 className="text-[24px] font-normal leading-8 text-foreground">{word}, {first || "there"} <span aria-hidden="true">{emoji}</span></h1>

          <section aria-labelledby="pa-h" className="mt-7">
            <div className="flex h-5 items-center justify-between">
              <h2 id="pa-h" className="flex items-center gap-2 text-[14px] text-fg2"><Sparkles className="size-4" strokeWidth={1.5} /> Personal Assistant <Info className="size-3.5 text-fg3" strokeWidth={1.5} /></h2>
              <Link href="/settings/ai" className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"><Settings className="size-4" strokeWidth={1.5} /> Manage</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <AssistantCard href={`/askfred?q=${encodeURIComponent("Prepare a daily brief based on my recent meetings")}`} icon={Rss} tile="bg-[#5865c9]" title="Daily Brief" text="No brief yet" />
              <AssistantCard icon={CalendarCheck} tile="bg-[#d9675b]" title="Meeting Prep" text="No upcoming meetings" />
              <AssistantCard href="/tasks" icon={ListChecks} tile="bg-[#7fa11b]" title="Tasks" text={openTasks === undefined ? "…" : `${openTasks} New task${openTasks === 1 ? "" : "s"}`} />
            </div>
          </section>

          <section className="mt-[42px]">
            <div className="flex items-center justify-between">
              <div role="tablist" aria-label="Meeting feed" className="inline-flex rounded-md bg-muted p-[3px]">
                {([["recent", "Recent"], ["upcoming", "Upcoming"], ["feed", "AI Feed"]] as const).map(([v, label]) => (
                  <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                    className={cn("h-[30px] rounded-[5px] px-3.5 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", tab === v ? "bg-seg text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
              <Link href="/settings/recording-privacy" className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"><CalendarCog className="size-4" strokeWidth={1.5} /> Settings</Link>
            </div>
            <div className="mt-3 min-h-24">{hydrated ? <Feed tab={tab} /> : <Skeleton className="h-24" />}</div>
          </section>

          <section className="mt-12">
            <h2 className="text-[20px] font-normal text-foreground">Try More</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {MORE.map(({ href, icon: Icon, title, text }) => (
                <Link key={href} href={href} className="flex min-h-[150px] flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface">
                  <Icon className="size-5 text-iris" strokeWidth={1.5} />
                  <p className="mt-3 text-[14px] text-foreground">{title}</p>
                  <p className="mt-1.5 flex-1 text-[14px] leading-[22px] text-muted-foreground">{text}</p>
                  <span className="mt-3 inline-flex h-8 w-fit items-center rounded-md bg-primary px-3 text-[14px] text-white">{title === "Analytics" ? "Open" : "Explore"}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      <DockedAsk scopeLabel="My Meetings" variant="home" />
    </div>
  );
}
