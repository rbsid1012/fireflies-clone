"use client";

import { memo } from "react";
import { Bookmark } from "lucide-react";
import { formatTimestamp } from "@/lib/time";
import type { TextPart } from "@/lib/transcript-tools";
import type { TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SpeakerAvatar } from "./SpeakerAvatar";

type Props = {
  segment: TranscriptSegment;
  active: boolean;
  /** The text split into plain and highlighted runs, or null when there is no search. */
  parts: TextPart[] | null;
  /** Number of the search match currently selected, to give it the strong highlight. */
  currentMatch: number;
  onSeek: (ms: number) => void;
  /** Whether this line is already inside a saved soundbite. */
  saved?: boolean;
  onSave?: (segment: TranscriptSegment) => void;
};

/** One utterance. Clicking anywhere on it (or pressing Enter) seeks the player to when it was said. */
export const TranscriptLine = memo(function TranscriptLine({ segment, active, parts, currentMatch, onSeek, saved = false, onSave }: Props) {
  return (
    <div
      role="button" tabIndex={0} data-seq={segment.seq} aria-current={active ? "true" : undefined}
      onClick={() => onSeek(segment.start_ms)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSeek(segment.start_ms); }
      }}
      // content-visibility lets the browser skip painting off-screen lines: cheap virtualisation for long transcripts
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 84px" }}
      className={cn(
        "group cursor-pointer rounded-lg border-l-2 border-transparent px-3 py-2.5 outline-none transition-colors",
        "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "border-primary bg-primary/10 hover:bg-primary/15",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <SpeakerAvatar name={segment.speaker_name ?? "Unknown"} colorIndex={segment.color_index} className="size-5 text-[9px]" />
        <span className="text-[13px] font-medium text-foreground/90">{segment.speaker_name ?? "Unknown"}</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">{formatTimestamp(segment.start_ms)}</span>
        {onSave && (
          <button
            type="button" aria-label={saved ? "Saved as a soundbite" : "Save as a soundbite"} title={saved ? "Saved as a soundbite" : "Save as a soundbite"}
            onClick={(e) => { e.stopPropagation(); if (!saved) onSave(segment); }}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn("ml-auto grid size-6 place-items-center rounded-md outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50", saved ? "text-iris" : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100")}
          ><Bookmark className="size-3.5" strokeWidth={1.5} fill={saved ? "currentColor" : "none"} /></button>
        )}
      </div>
      <p className="pl-7 text-[14px] leading-6 text-foreground/85">
        {parts
          ? parts.map((p, i) =>
              p.match === null ? p.text : (
                <mark key={i} data-match={p.match} className={cn("rounded px-0.5 text-foreground", p.match === currentMatch ? "bg-primary text-primary-foreground" : "bg-yellow-400/30")}>
                  {p.text}
                </mark>
              ),
            )
          : segment.text}
      </p>
    </div>
  );
});
