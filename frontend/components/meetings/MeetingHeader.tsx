"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, FileAudio, FileText, Hash, Layers, Menu, MoreHorizontal, Pencil, Plus, RefreshCw, Share2, Trash2, Upload } from "lucide-react";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { useShell } from "@/components/layout/ShellContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMeetingMutations } from "@/hooks/useMeetingMutations";
import type { MeetingDetail } from "@/lib/types";
import { DeleteDialog } from "./DeleteDialog";
import { EditMeetingModal } from "./EditMeetingModal";

const MEDIA_ACCEPT = "audio/*,video/*,.mp3,.m4a,.wav,.mp4,.webm,.ogg,.aac,.mov";
const iconBtn = "grid size-9 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

/** The meeting page's own top bar: menu, breadcrumb, actions, share and account. */
export function MeetingHeader({ meeting }: { meeting: MeetingDetail }) {
  const { openNav } = useShell();
  const { exportAs, regenerate, attachMedia, removeMedia } = useMeetingMutations(meeting.id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasMedia = !!meeting.media_url;

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b bg-surface px-3 md:px-4">
      <button type="button" onClick={openNav} aria-label="Open navigation" className={iconBtn}><Menu className="size-5" strokeWidth={1.6} /></button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px]">
        <Link href="/meetings" className="inline-flex shrink-0 items-center gap-0.5 text-foreground/85 hover:text-foreground"><Hash className="size-4" strokeWidth={1.6} />All Meetings</Link>
        <span className="text-muted-foreground">/</span>
        <span className="truncate text-foreground/85">{meeting.title}</span>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More actions" className={`${iconBtn} relative shrink-0`}>
          <MoreHorizontal className="size-4" />
          {meeting.status === "ready" && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-emerald-400" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Edit details</DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInput.current?.click()}><Upload /> {hasMedia ? "Replace recording" : "Attach a recording"}</DropdownMenuItem>
          {hasMedia && <DropdownMenuItem onClick={() => removeMedia.mutate()}><FileAudio /> Remove recording</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => regenerate.mutate()}><RefreshCw /> Regenerate summary</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> Delete meeting</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="flex-1" />

      <Link href="/upgrade" className="hidden h-9 items-center rounded-lg bg-success px-3 text-[14px] text-success-foreground transition-opacity hover:opacity-90 sm:flex">Upgrade</Link>
      <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
      <Link href="/integrations" aria-label="Integrations" title="Integrations" className={`${iconBtn} hidden sm:grid`}><Layers className="size-[18px]" strokeWidth={1.6} /></Link>

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-[14px] font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50" disabled={exportAs.isPending}>
          <Share2 className="size-4" strokeWidth={1.8} /> <span className="hidden sm:inline">Share</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => exportAs.mutate("md")}><FileText /> Download Markdown (.md)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportAs.mutate("txt")}><Download /> Download plain text (.txt)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Share a link <span className="ml-auto text-[11px] text-muted-foreground">Not available</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href="/upload" aria-label="Add a meeting" title="Add a meeting" className={`${iconBtn} border`}><Plus className="size-[18px]" strokeWidth={1.6} /></Link>
      <NotificationsBell />
      <ProfileMenu collapsed placement={{ side: "bottom", align: "end" }} />

      <input
        ref={fileInput} type="file" accept={MEDIA_ACCEPT} hidden aria-label="Choose a recording"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) attachMedia.mutate(f); e.target.value = ""; }}
      />
      <EditMeetingModal meeting={meeting} open={editing} onOpenChange={setEditing} />
      <DeleteDialog meeting={meeting} open={deleting} onOpenChange={setDeleting} />
    </header>
  );
}
