"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AudioLines, Bookmark, FileQuestion, Loader2, MessageSquare, Search, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { AskPanel } from "@/components/ask/AskPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { PlayerBar } from "@/components/player/PlayerBar";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerProvider";
import { SkillsTab } from "@/components/summary/SkillsTab";
import { NotesView } from "@/components/summary/NotesView";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActiveSkills } from "@/hooks/useActiveSkills";
import { useHydrated } from "@/hooks/useHydrated";
import { useMeeting, useTranscript } from "@/hooks/useMeeting";
import { useMeetingMutations } from "@/hooks/useMeetingMutations";
import { ApiError, mediaUrl } from "@/lib/api";
import type { MeetingDetail as Meeting, Transcript } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MeetingHeader } from "./MeetingHeader";
import { MeetingTitleBlock } from "./MeetingTitleBlock";

type View = "notes" | "transcript" | "ask";

function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col" role="status" aria-label="Loading meeting">
      <div className="space-y-3 border-b px-6 py-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-80" /><Skeleton className="h-4 w-64" /></div>
      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[400px_1fr]">
        <div className="hidden space-y-3 border-r p-4 lg:block">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        <div className="space-y-4 p-6"><Skeleton className="h-9 w-72" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      </div>
    </div>
  );
}

/** Jump to ?t=<ms> once the player exists (links from search results and other meetings' answers). */
function DeepLink({ ready }: { ready: boolean }) {
  const t = useSearchParams().get("t");
  const player = usePlayer();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready || done || !player || !t || !/^\d+$/.test(t)) return;
    player.seek(Number(t));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(true);
  }, [ready, done, player, t]);
  return null;
}

type RailTab = "search" | "insights" | "transcript" | "soundbites";
const RAIL: { key: RailTab; label: string; icon: LucideIcon }[] = [
  { key: "search", label: "Smart Search", icon: Search },
  { key: "insights", label: "Insights", icon: AudioLines },
  { key: "transcript", label: "Transcript", icon: MessageSquare },
  { key: "soundbites", label: "Soundbites", icon: Bookmark },
];

function Body({ meeting, transcript }: { meeting: Meeting; transcript: Transcript }) {
  const player = usePlayer();
  const { regenerate, identifySpeakers } = useMeetingMutations(meeting.id);
  const [view, setView] = useState<View>("notes");
  const [rail, setRail] = useState<RailTab>("search");
  const [center, setCenter] = useState<"notes" | "skills">("notes");
  const [askOpen, setAskOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSkills] = useActiveSkills();

  const taskSegmentIds = useMemo(() => new Set(meeting.action_items.map((a) => a.source_segment_id).filter((x): x is number => x !== null)), [meeting.action_items]);
  const keywords = meeting.summary?.keywords ?? [];

  const showLines = useCallback(() => { setView("transcript"); setRail((r) => (r === "insights" || r === "soundbites" ? "transcript" : r)); }, []);
  const jump = useCallback((ms: number) => { player?.seek(ms); player?.play(); showLines(); }, [player, showLines]);

  const transcriptPanel = (mode: "search" | "insights" | "transcript") => (
    <TranscriptPanel meetingId={meeting.id} segments={transcript.segments} keywords={keywords} taskSegmentIds={taskSegmentIds} query={query} onQueryChange={setQuery} mode={mode} onIdentify={() => identifySpeakers.mutate()} identifying={identifySpeakers.isPending} />
  );
  const notes = (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 md:px-8">
      <MeetingTitleBlock meeting={meeting} />
      {meeting.status === "failed" && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-[14px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1"><p className="font-medium">Processing didn&apos;t finish</p><p className="text-muted-foreground">The transcript was saved, but the summary couldn&apos;t be generated.</p></div>
          <Button size="lg" className="h-8 px-3 text-[13px]" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>Retry</Button>
        </div>
      )}
      {meeting.status === "processing" && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border bg-card p-4 text-[14px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Still processing. This page updates by itself.</p>
      )}
      {center === "notes" ? <NotesView meeting={meeting} transcript={transcript} onJump={jump} onSkillRun={() => { setView("ask"); setAskOpen(true); }} /> : <SkillsTab meetingId={meeting.id} onRun={() => { setView("ask"); setAskOpen(true); }} />}
    </div>
  );

  const tab = (v: View, label: string) => (
    <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
      className={cn("h-9 flex-1 rounded-lg text-[14px] transition-colors", view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MeetingHeader meeting={meeting} />

      {/* Below lg the three panels become tabs */}
      <div className="flex shrink-0 gap-1 border-b p-2 lg:hidden" role="group" aria-label="Meeting sections">
        {tab("notes", "Notes")}{tab("transcript", "Transcript")}{tab("ask", "Ask Fred")}
      </div>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Meeting tools" className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3 lg:flex">
          {RAIL.map(({ key, label, icon: Icon }) => (
            <Tooltip key={key}>
              <TooltipTrigger
                onClick={() => setRail(key)} aria-label={label} aria-pressed={rail === key}
                className={cn("grid size-9 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", rail === key ? "bg-iris-chip text-iris" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              ><Icon className="size-4" strokeWidth={1.5} /></TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className={cn("min-h-0 w-full border-r lg:block lg:w-[338px] lg:shrink-0", view === "transcript" ? "block" : "hidden")}>
          {rail === "soundbites" ? (
            <section aria-label="Soundbites" className="flex h-full flex-col"><h2 className="flex h-14 shrink-0 items-center border-b px-6 text-[16px]">Soundbites</h2>
              <EmptyState icon={Bookmark} title="Soundbites aren't part of this version" description="Saving short clips from a recording isn't built yet. Timestamps in the transcript still jump to any moment." /></section>
          ) : transcriptPanel(rail)}
        </div>

        <div className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto lg:block", view === "notes" ? "block" : "hidden")}>
          <div className="sticky top-0 z-10 flex justify-center bg-background/90 pt-[22px] backdrop-blur">
            <div role="tablist" aria-label="Notes or AI Skills" className="inline-flex rounded-md bg-muted p-[3px]">
              {([["notes", "Notes"], ["skills", `AI Skills ${activeSkills.length}`]] as const).map(([v, label]) => (
                <button key={v} type="button" role="tab" aria-selected={center === v} onClick={() => setCenter(v)}
                  className={cn("h-[30px] rounded-[5px] px-3.5 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", center === v ? "bg-seg text-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
              ))}
            </div>
          </div>
          {notes}
          <Button
            variant="outline" size="lg" onClick={() => setAskOpen(true)}
            className="fixed bottom-24 right-6 hidden h-10 gap-2 rounded-full bg-card px-4 text-[14px] shadow-lg lg:inline-flex xl:hidden"
          ><Sparkles className="size-4 text-iris-soft" /> Ask Fred</Button>
        </div>
        <div className={cn("min-h-0 w-full xl:block xl:w-[405px] xl:shrink-0 xl:border-l xl:border-border", view === "ask" ? "block" : "hidden", "xl:block! max-xl:lg:hidden!")}>
          <AskPanel meetingId={meeting.id} />
        </div>
      </div>

      <PlayerBar chapters={meeting.chapters} downloadUrl={mediaUrl(meeting.media_url)} meetingId={meeting.id} />

      <Sheet open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent side="right" showCloseButton className="w-[min(92vw,400px)] gap-0 p-0 sm:max-w-[400px]">
          <SheetTitle className="sr-only">Ask Fred</SheetTitle>
          <AskPanel meetingId={meeting.id} />
        </SheetContent>
      </Sheet>
      <Suspense><DeepLink ready /></Suspense>
    </div>
  );
}

export function MeetingDetail({ id }: { id: number }) {
  const hydrated = useHydrated();
  const meeting = useMeeting(id);
  const transcript = useTranscript(id);

  if (!hydrated) return <DetailSkeleton />;
  if (meeting.isError) {
    const notFound = meeting.error instanceof ApiError && meeting.error.status === 404;
    return (
      <EmptyState
        icon={notFound ? FileQuestion : TriangleAlert} title={notFound ? "Meeting not found" : "Couldn't load this meeting"}
        description={notFound ? "It may have been deleted, or it belongs to another account." : (meeting.error as Error).message}
        action={notFound
          ? <Link href="/meetings" className={cn(buttonVariants({ size: "lg" }), "h-9 px-3.5 text-[14px]")}>Back to meetings</Link>
          : <Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => meeting.refetch()}>Try again</Button>}
      />
    );
  }
  if (!meeting.data || !transcript.data) {
    if (transcript.isError) return <EmptyState icon={TriangleAlert} title="Couldn't load the transcript" description={(transcript.error as Error).message} action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => transcript.refetch()}>Try again</Button>} />;
    return <DetailSkeleton />;
  }
  return (
    <PlayerProvider src={mediaUrl(meeting.data.media_url)} durationMs={meeting.data.duration_ms}>
      <Body meeting={meeting.data} transcript={transcript.data} />
    </PlayerProvider>
  );
}
