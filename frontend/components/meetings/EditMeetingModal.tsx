"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SpeakerAvatar } from "@/components/transcript/SpeakerAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTags } from "@/hooks/useLibraryData";
import { useMeetingMutations, type MeetingEdit } from "@/hooks/useMeetingMutations";
import { ApiError } from "@/lib/api";
import type { MeetingDetail } from "@/lib/types";
import { TagInput } from "./TagInput";

const field = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/** ISO instant -> the value a <input type=datetime-local> expects, in the viewer's time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = { meeting: MeetingDetail; open: boolean; onOpenChange: (open: boolean) => void };

/** The form body is a separate component so its state resets each time the dialog is opened. */
function EditForm({ meeting, onDone }: { meeting: MeetingDetail; onDone: () => void }) {
  const { update } = useMeetingMutations(meeting.id);
  const knownTags = useTags().data ?? [];
  const [title, setTitle] = useState(meeting.title);
  const [when, setWhen] = useState(toLocalInput(meeting.started_at));
  const [tags, setTags] = useState(meeting.tags.map((t) => t.name));
  const [speakers, setSpeakers] = useState(Object.fromEntries(meeting.participants.map((p) => [p.id, { name: p.name, email: p.email ?? "" }])));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: MeetingEdit = {};
    if (title.trim() && title.trim() !== meeting.title) patch.title = title.trim();
    if (when && toLocalInput(meeting.started_at) !== when) patch.started_at = new Date(when).toISOString();
    if (tags.join("\n") !== meeting.tags.map((t) => t.name).join("\n")) patch.tags = tags;
    const changedSpeakers = meeting.participants.filter((p) => speakers[p.id].name.trim() !== p.name || speakers[p.id].email.trim() !== (p.email ?? ""));
    if (changedSpeakers.length) patch.participants = changedSpeakers.map((p) => ({ id: p.id, name: speakers[p.id].name.trim(), email: speakers[p.id].email.trim() || null }));
    if (Object.keys(patch).length === 0) return onDone();
    update.mutate(patch, { onSuccess: onDone });
  };

  const error = update.error instanceof ApiError ? update.error.message : null;
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="edit-title" className="text-[13px] text-muted-foreground">Title</label>
        <input id="edit-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required autoFocus />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="edit-when" className="text-[13px] text-muted-foreground">Date and time</label>
        <input id="edit-when" type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <span className="text-[13px] text-muted-foreground">Tags</span>
        <TagInput value={tags} onChange={setTags} known={knownTags} />
      </div>
      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-[13px] text-muted-foreground">Who&apos;s who (rename a speaker or add their email so they get the recap)</legend>
        {meeting.participants.map((p) => (
          <div key={p.id} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
            <SpeakerAvatar name={speakers[p.id].name || p.speaker_label} colorIndex={p.color_index} className="size-7 text-[11px]" />
            <input aria-label={`Name for ${p.speaker_label}`} className={field} value={speakers[p.id].name} maxLength={120} placeholder={p.speaker_label}
              onChange={(e) => setSpeakers((s) => ({ ...s, [p.id]: { ...s[p.id], name: e.target.value } }))} />
            <input aria-label={`Email for ${p.speaker_label}`} type="email" className={field} value={speakers[p.id].email} placeholder="Email (optional)"
              onChange={(e) => setSpeakers((s) => ({ ...s, [p.id]: { ...s[p.id], email: e.target.value } }))} />
          </div>
        ))}
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={onDone} disabled={update.isPending}>Cancel</Button>
        <Button type="submit" size="lg" className="h-9 gap-2 px-3.5 text-[14px]" disabled={update.isPending || !title.trim()}>
          {update.isPending && <Loader2 className="size-4 animate-spin" />} Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditMeetingModal({ meeting, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit meeting</DialogTitle>
          <DialogDescription>Change the details people see in your library.</DialogDescription>
        </DialogHeader>
        {open && <EditForm meeting={meeting} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
