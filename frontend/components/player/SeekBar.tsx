"use client";

import { formatTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useCurrentMs, usePlayer, usePlayerState } from "./PlayerProvider";

type Props = { chapters?: { start_ms: number; title: string }[]; className?: string };

/**
 * A native range input (so keyboard, touch and screen readers work) drawn as a custom track with a
 * tick at each chapter. Dragging seeks continuously, so the transcript follows the thumb.
 */
export function SeekBar({ chapters = [], className }: Props) {
  const player = usePlayer();
  const ms = useCurrentMs();
  const { durationMs } = usePlayerState();
  const pct = durationMs > 0 ? Math.min(100, (ms / durationMs) * 100) : 0;

  return (
    <div className={cn("group relative h-5", className)}>
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted transition-[height] group-hover:h-1.5">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {durationMs > 0 && chapters.map((c) => (
        <span key={c.start_ms + c.title} aria-hidden="true" className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-foreground/40" style={{ left: `${(c.start_ms / durationMs) * 100}%` }} />
      ))}
      <span aria-hidden="true" className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" style={{ left: `${pct}%` }} />
      <input
        type="range" min={0} max={Math.max(durationMs, 1)} step={250} value={Math.min(ms, durationMs || 0)}
        disabled={!player || durationMs === 0}
        onChange={(e) => player?.seek(Number(e.target.value))}
        aria-label="Seek" aria-valuetext={`${formatTimestamp(ms)} of ${formatTimestamp(durationMs)}`}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </div>
  );
}
