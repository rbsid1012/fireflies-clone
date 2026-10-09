"use client";

import { ChevronDown, Download, Pause, Play, RotateCcw, RotateCw, Square, SquareCheck, Star, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { useMeetingMarks } from "@/hooks/useMeetingMarks";
import { RATES } from "@/lib/player";
import { formatTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useCurrentMs, usePlayer, usePlayerState } from "./PlayerProvider";
import { SeekBar } from "./SeekBar";

const SKIP_MS = 10_000;

function Clock() {
  const ms = useCurrentMs();
  const { durationMs } = usePlayerState();
  return (
    <span className="inline-flex items-center gap-2 text-[14px] tabular-nums text-muted-foreground">
      <span><span className="text-foreground">{formatTimestamp(ms)}</span> / {formatTimestamp(durationMs)}</span>
      <ChevronDown className="size-3.5" strokeWidth={1.5} />
    </span>
  );
}

const iconButton = "grid size-9 place-items-center rounded-full text-fg2 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40";

/** Bottom bar: clock, speed / skip / play / download, and personal markers. */
export function PlayerBar({ chapters, downloadUrl, meetingId }: { chapters: { start_ms: number; title: string }[]; downloadUrl?: string | null; meetingId: number }) {
  const player = usePlayer();
  const { playing, rate, mode, error } = usePlayerState();
  const [marks, setMarks] = useMeetingMarks(meetingId);
  const nextRate = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length];

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 pb-0 pt-0" role="group" aria-label="Playback controls">
      <div className="-mx-4"><SeekBar chapters={chapters} /></div>
      <div className="grid h-[62px] grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center gap-3"><Clock />
          {(error || mode === "simulated") && <span className="text-[12px] text-fg3" title="No recording is attached, so a clock stands in for the audio. The transcript stays in sync.">{error ? <span className="inline-flex items-center gap-1 text-destructive"><TriangleAlert className="size-3" /> Simulated</span> : "No audio"}</span>}
        </div>
        <div className="flex items-center gap-[22px]">
          <button type="button" onClick={() => player?.setRate(nextRate)} aria-label={`Playback speed ${rate}x. Change speed`} className="h-8 min-w-9 rounded-md px-1 text-[14px] tabular-nums text-fg2 hover:text-foreground">{rate}×</button>
          <button type="button" onClick={() => player?.skip(-SKIP_MS)} disabled={!player} aria-label="Back 10 seconds" className={iconButton}><RotateCcw className="size-[18px]" strokeWidth={1.5} /></button>
          <button
            type="button" onClick={() => player?.toggle()} disabled={!player} aria-label={playing ? "Pause" : "Play"}
            className="grid h-[31px] w-[50px] place-items-center rounded-full bg-[#5a3fe0] text-white outline-none transition-colors hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
          </button>
          <button type="button" onClick={() => player?.skip(SKIP_MS)} disabled={!player} aria-label="Forward 10 seconds" className={iconButton}><RotateCw className="size-[18px]" strokeWidth={1.5} /></button>
          {downloadUrl ? <a href={downloadUrl} download aria-label="Download the recording" title="Download the recording" className={iconButton}><Download className="size-[18px]" strokeWidth={1.5} /></a> : <span className={cn(iconButton, "pointer-events-none opacity-40")} aria-hidden="true"><Download className="size-[18px]" strokeWidth={1.5} /></span>}
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" aria-pressed={marks.starred} aria-label="Favourite this meeting" title="Favourite (saved in this browser)" onClick={() => setMarks({ starred: !marks.starred })} className={cn(iconButton, marks.starred && "text-amber-400")}><Star className={cn("size-[18px]", marks.starred && "fill-current")} strokeWidth={1.5} /></button>
          <button type="button" aria-pressed={marks.reviewed} aria-label="Mark as reviewed" title="Mark as reviewed (saved in this browser)" onClick={() => setMarks({ reviewed: !marks.reviewed })} className={cn(iconButton, marks.reviewed && "text-emerald-400")}>{marks.reviewed ? <SquareCheck className="size-[18px]" strokeWidth={1.5} /> : <Square className="size-[18px]" strokeWidth={1.5} />}</button>
          <button type="button" aria-pressed={marks.vote === "up"} aria-label="Helpful" title="Helpful (saved in this browser)" onClick={() => setMarks({ vote: marks.vote === "up" ? null : "up" })} className={cn(iconButton, marks.vote === "up" && "text-iris")}><ThumbsUp className="size-[18px]" strokeWidth={1.5} /></button>
          <button type="button" aria-pressed={marks.vote === "down"} aria-label="Not helpful" title="Not helpful (saved in this browser)" onClick={() => setMarks({ vote: marks.vote === "down" ? null : "down" })} className={cn(iconButton, marks.vote === "down" && "text-iris")}><ThumbsDown className="size-[18px]" strokeWidth={1.5} /></button>
        </div>
      </div>
    </div>
  );
}
