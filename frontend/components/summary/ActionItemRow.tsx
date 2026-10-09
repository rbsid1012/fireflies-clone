"use client";

import { useRef, useState } from "react";
import { CalendarDays, CornerDownRight, Trash2, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpeakerAvatar } from "@/components/transcript/SpeakerAvatar";
import type { ActionItemEdit } from "@/hooks/useMeetingMutations";
import { formatDay } from "@/lib/dates";
import { formatTimestamp } from "@/lib/time";
import type { ActionItem, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  item: ActionItem;
  participants: Participant[];
  onToggle: (done: boolean) => void;
  onEdit: (patch: ActionItemEdit) => void;
  onDelete: () => void;
  onJump?: (ms: number) => void;
};

const chip = "inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AssigneeMenu({ item, participants, onPick }: { item: ActionItem; participants: Participant[]; onPick: (id: number | null) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={chip} aria-label={item.assignee ? `Assigned to ${item.assignee.name}. Change` : "Assign"}>
        {item.assignee ? (<><SpeakerAvatar name={item.assignee.name} colorIndex={item.assignee.color_index} className="size-4 text-[8px]" />{item.assignee.name}</>) : (<><UserRound className="size-3.5" />Assign</>)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {participants.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => onPick(p.id)} className="gap-2">
            <SpeakerAvatar name={p.name} colorIndex={p.color_index} className="size-5 text-[9px]" /> {p.name}
          </DropdownMenuItem>
        ))}
        {item.assignee && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onPick(null)}>Unassign</DropdownMenuItem></>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DueDate({ item, onPick }: { item: ActionItem; onPick: (day: string | null) => void }) {
  const overdue = !!item.due_date && !item.is_completed && item.due_date < today();
  return (
    <Popover>
      <PopoverTrigger className={cn(chip, overdue && "text-destructive hover:text-destructive")} aria-label={item.due_date ? `Due ${formatDay(item.due_date)}. Change` : "Add a due date"}>
        <CalendarDays className="size-3.5" />
        {item.due_date ? formatDay(item.due_date) : "Due date"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] gap-3 p-3">
        <label className="text-[13px] text-muted-foreground" htmlFor={`due-${item.id}`}>Due date</label>
        <input
          id={`due-${item.id}`} type="date" defaultValue={item.due_date ?? ""} onChange={(e) => e.target.value && onPick(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-ring"
        />
        {item.due_date && <button type="button" onClick={() => onPick(null)} className="self-start text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">Remove due date</button>}
      </PopoverContent>
    </Popover>
  );
}

/** One action item: tick it, edit its text in place, assign it, date it, jump to where it was said. */
export function ActionItemRow({ item, participants, onToggle, onEdit, onDelete, onJump }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const input = useRef<HTMLInputElement>(null);
  const pending = item.id < 0; // created optimistically, the server hasn't confirmed yet

  const startEdit = () => { setDraft(item.text); setEditing(true); requestAnimationFrame(() => input.current?.select()); };
  const commit = () => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== item.text) onEdit({ text });
  };

  return (
    <li className={cn("group flex gap-3 rounded-xl border bg-card p-3.5 transition-opacity", pending && "opacity-60")}>
      <Checkbox
        checked={item.is_completed} disabled={pending} onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Mark "${item.text}" ${item.is_completed ? "not done" : "done"}`} className="mt-1"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} maxLength={1000} aria-label="Action item text"
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-md border border-ring bg-background px-2 py-1 text-[14px] outline-none"
          />
        ) : (
          <button type="button" onClick={startEdit} disabled={pending} title="Click to edit"
            className={cn("block w-full text-left text-[14px] leading-6 outline-none focus-visible:underline", item.is_completed && "text-muted-foreground line-through")}>
            {item.text}
          </button>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1 -ml-2.5">
          <AssigneeMenu item={item} participants={participants} onPick={(id) => onEdit({ assignee_participant_id: id })} />
          <DueDate item={item} onPick={(day) => onEdit({ due_date: day })} />
          {item.source_start_ms !== null && onJump && (
            <button type="button" onClick={() => onJump(item.source_start_ms!)} className={chip} aria-label={`Jump to ${formatTimestamp(item.source_start_ms)} in the meeting`}>
              <CornerDownRight className="size-3.5" /> {formatTimestamp(item.source_start_ms)}
            </button>
          )}
        </div>
      </div>
      <button
        type="button" onClick={onDelete} disabled={pending} aria-label="Delete action item"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 outline-none transition hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100 max-sm:opacity-100"
      >
        <Trash2 className="size-4" strokeWidth={1.6} />
      </button>
    </li>
  );
}
