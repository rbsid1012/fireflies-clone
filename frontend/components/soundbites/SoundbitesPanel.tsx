"use client";

import { useState } from "react";
import { Bookmark, Play, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useSoundbites } from "@/hooks/useSoundbites";
import { formatTimestamp } from "@/lib/time";
import type { Soundbite } from "@/lib/types";

/** The note is saved when the field loses focus or Enter is pressed, and only if it changed. */
function Note({ soundbite, onSave }: { soundbite: Soundbite; onSave: (note: string) => void }) {
  const [value, setValue] = useState(soundbite.note);
  const commit = () => { if (value.trim() !== soundbite.note) onSave(value); };
  return (
    <input
      value={value} maxLength={500} aria-label="Note" placeholder="Add a note"
      onChange={(e) => setValue(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="mt-2 h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] text-fg2 outline-none placeholder:text-fg4 hover:border-input focus:border-iris"
    />
  );
}

/** Every saved moment of this meeting. Saving one is done from the bookmark on a transcript line. */
export function SoundbitesPanel({ meetingId, onJump }: { meetingId: number; onJump: (ms: number) => void }) {
  const { soundbites, isPending, isError, setNote, remove } = useSoundbites(meetingId);
  return (
    <section aria-label="Soundbites" className="flex h-full min-h-0 flex-col">
      <h2 className="flex h-14 shrink-0 items-center justify-between border-b px-6 text-[16px]">
        Soundbites {soundbites.length > 0 && <span className="text-[13px] text-fg3">{soundbites.length}</span>}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending && <div className="space-y-3 p-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
        {isError && <p role="alert" className="p-6 text-[14px] text-destructive">Couldn&apos;t load the soundbites.</p>}
        {!isPending && !isError && soundbites.length === 0 && (
          <EmptyState icon={Bookmark} title="No soundbites yet" description="Hover a line in the transcript and click its bookmark to save that moment here." />
        )}
        <ul className="space-y-3 p-4">
          {soundbites.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 text-[12px] text-fg3">
                <button type="button" onClick={() => onJump(s.start_ms)} aria-label={`Play from ${formatTimestamp(s.start_ms)}`}
                  className="inline-flex items-center gap-1 rounded-md text-iris outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 tabular-nums">
                  <Play className="size-3" fill="currentColor" /> {formatTimestamp(s.start_ms)} – {formatTimestamp(s.end_ms)}
                </button>
                {s.speaker_name && <span className="truncate">{s.speaker_name}</span>}
                <button type="button" onClick={() => remove.mutate(s.id)} aria-label="Remove soundbite" className="ml-auto grid size-7 place-items-center rounded-md text-fg3 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <p className="mt-2 line-clamp-4 text-[14px] leading-6 text-fg2">&ldquo;{s.text}&rdquo;</p>
              <Note key={s.note} soundbite={s} onSave={(note) => setNote.mutate({ id: s.id, note })} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
