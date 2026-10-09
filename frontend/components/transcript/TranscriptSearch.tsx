"use client";

import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Total matches, or null while the search is running. */
  total: number | null;
  /** Zero-based index of the selected match. */
  current: number;
  onStep: (direction: 1 | -1) => void;
};

const arrow = "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";

/** "Smart search" box: highlights every match, shows "3 of 12", Enter / Shift+Enter (or the arrows) step through them. */
export function TranscriptSearch({ value, onChange, total, current, onStep }: Props) {
  const hasQuery = value.trim().length > 0;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onStep(e.shiftKey ? -1 : 1); }
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Search the transcript" aria-label="Search the transcript" maxLength={200}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-card pl-9 text-[14px] outline-none transition-colors placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30", hasQuery ? "pr-[132px]" : "pr-3",
        )}
      />
      {hasQuery && (
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <span className="min-w-[52px] pr-1 text-right text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
            {total === null ? <Loader2 className="ml-auto size-3.5 animate-spin" /> : total === 0 ? "No matches" : `${current + 1} of ${total}`}
          </span>
          <button type="button" className={arrow} onClick={() => onStep(-1)} disabled={!total} aria-label="Previous match"><ChevronUp className="size-4" /></button>
          <button type="button" className={arrow} onClick={() => onStep(1)} disabled={!total} aria-label="Next match"><ChevronDown className="size-4" /></button>
          <button type="button" className={arrow} onClick={() => onChange("")} aria-label="Clear search"><X className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
