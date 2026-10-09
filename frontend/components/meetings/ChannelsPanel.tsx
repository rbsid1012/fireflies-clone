"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, FolderOpen, Hash, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTags } from "@/hooks/useLibraryData";
import { api, ApiError } from "@/lib/api";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChannelView = "mine" | "all";
type Props = {
  activeTag: string;
  source: string;
  view: ChannelView;
  onSelect: (next: { tag?: string; source?: "" | "upload"; view: ChannelView }) => void;
};

function Row({ active, onClick, disabled, title, children }: { active?: boolean; onClick?: () => void; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title} aria-pressed={active}
      className={cn(
        "flex h-11 w-full items-center gap-3.5 rounded-lg px-3.5 text-left text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-iris-chip text-iris-soft" : "text-foreground/80 hover:bg-accent/60",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >{children}</button>
  );
}

function CreateChannel({ onClose, onCreated }: { onClose: () => void; onCreated: (tag: Tag) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<Tag>("/api/tags", { name }),
    onSuccess: (tag) => { qc.invalidateQueries({ queryKey: ["tags"] }); onCreated(tag); onClose(); },
  });
  const error = create.error instanceof ApiError ? create.error.message.replace(/^name: /, "") : create.error ? "Couldn't create the channel." : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>Channels group related meetings, like “Customers” or “Weekly sync”. Add a meeting to one from its edit dialog.</DialogDescription>
          </DialogHeader>
          <input aria-label="Channel name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Channel name"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" className="h-9 gap-2 px-3.5 text-[14px]" disabled={!name.trim() || create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create channel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Left panel from the reference: built-in views, then "All channels" (this app's tags). */
export function ChannelsPanel({ activeTag, source, view, onSelect }: Props) {
  const tags = useTags();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tags/${id}`),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      if (deleting && deleting.id === id && deleting.name.toLowerCase() === activeTag.toLowerCase()) onSelect({ tag: "", view });
      setDeleting(null);
      toast.success("Channel deleted");
    },
    onError: () => toast.error("Couldn't delete the channel."),
  });

  const q = filter.trim().toLowerCase();
  const channels = (tags.data ?? []).filter((t) => !q || t.name.toLowerCase().includes(q));
  const builtIn = (label: string) => !q || label.toLowerCase().includes(q);
  const noFilter = !activeTag && !source;

  return (
    <nav aria-label="Channels" className="flex h-full flex-col">
      <div className="relative border-b border-border bg-surface">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
        <input
          value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search channels" aria-label="Search channels"
          className="h-[52px] w-full bg-transparent pl-10 pr-3 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:bg-accent/30"
        />
      </div>

      <div className="space-y-1 border-b p-3">
        {builtIn("My Meetings") && <Row active={noFilter && view === "mine"} onClick={() => onSelect({ tag: "", source: "", view: "mine" })}><Hash className="size-[18px]" strokeWidth={1.6} /> <span className="font-medium">My Meetings</span></Row>}
        {builtIn("All Meetings") && <Row active={noFilter && view === "all"} onClick={() => onSelect({ tag: "", source: "", view: "all" })}><FolderOpen className="size-[18px]" strokeWidth={1.6} /> All Meetings</Row>}
        {builtIn("Voice Agent Meetings") && <Row disabled title="Voice Agents are not part of this version"><Bot className="size-[18px]" strokeWidth={1.6} /> Voice Agent Meetings</Row>}
        {builtIn("Uploads") && (
          <Row active={source === "upload" && !activeTag} onClick={() => onSelect({ tag: "", source: "upload", view })}>
            <Upload className="size-[18px]" strokeWidth={1.6} /> Uploads <span className="rounded bg-success px-1.5 py-0.5 text-[11px] font-medium text-success-foreground">NEW</span>
          </Row>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="px-3.5 pb-2 pt-1 text-[14px] text-foreground/90">All channels</p>
        {tags.isPending ? (
          <p className="px-3.5 text-[13px] text-muted-foreground">Loading…</p>
        ) : channels.length === 0 && !q ? (
          <div className="flex flex-col items-center px-3 pt-4 text-center">
            <Hash className="size-6 text-pink-300" strokeWidth={1.4} />
            <p className="mt-3 text-[14px] leading-6">Create channels to organize your conversations</p>
            <Button variant="outline" size="lg" className="mt-4 h-10 gap-2 px-4 text-[14px]" onClick={() => setCreating(true)}><Plus className="size-4" /> Channel</Button>
          </div>
        ) : (
          <>
            <ul className="space-y-0.5">
              {channels.map((t) => (
                <li key={t.id} className="group relative">
                  <Row active={t.name.toLowerCase() === activeTag.toLowerCase()} onClick={() => onSelect({ tag: t.name, source: "", view })}>
                    <Hash className="size-[18px] shrink-0" strokeWidth={1.6} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="text-[12px] tabular-nums text-muted-foreground group-hover:opacity-0">{t.meeting_count}</span>
                  </Row>
                  <button type="button" aria-label={`Delete channel ${t.name}`} onClick={() => setDeleting(t)}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
            {channels.length === 0 && <p className="px-3.5 text-[13px] text-muted-foreground">No matching channels</p>}
            <Button variant="outline" size="lg" className="mt-3 h-9 w-full gap-2 text-[14px]" onClick={() => setCreating(true)}><Plus className="size-4" /> Channel</Button>
          </>
        )}
      </div>

      {creating && <CreateChannel onClose={() => setCreating(false)} onCreated={(t) => onSelect({ tag: t.name, source: "", view })} />}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this channel?" confirmLabel="Delete channel" pending={remove.isPending}
        description={<>“{deleting?.name}” is removed from its meetings. The meetings themselves are kept.</>} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </nav>
  );
}
