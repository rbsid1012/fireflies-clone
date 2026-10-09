"use client";

import Link from "next/link";
import { ChevronRight, CheckCheck, ListChecks, Loader2, TriangleAlert, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatMeetingDateTime } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { MeetingListItem } from "@/lib/types";
import { TagPill } from "./TagPill";
import { cn } from "@/lib/utils";

function ActionItemsChip({ total, open }: { total: number; open: number }) {
  if (total === 0) return null;
  const done = open === 0;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[13px]", done ? "text-success-foreground" : "text-muted-foreground")}
      title={done ? `All ${total} action items done` : `${open} of ${total} action items open`}
    >
      {done ? <CheckCheck className="size-4" strokeWidth={1.6} /> : <ListChecks className="size-4" strokeWidth={1.6} />}
      {done ? "Done" : `${open} open`}
    </span>
  );
}

export function MeetingCard({ meeting }: { meeting: MeetingListItem }) {
  const { user } = useAuth();
  // Added meetings belong to you; sample meetings list the first speaker as the host
  const host = (meeting.source === "seed" ? meeting.participants[0]?.name : user?.name) ?? user?.name ?? "";

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex min-h-[77px] items-center gap-4 rounded-xl border border-border px-5 py-[18px] outline-none transition-colors hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-[18px] text-white">
        {host.trim().charAt(0).toUpperCase() || "?"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="flex min-w-0 items-center gap-2 text-[14px] font-normal text-foreground">
            <span className="truncate">{meeting.title}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            {meeting.source === "upload" && <Upload className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-label="Uploaded" />}
          </h3>
          {meeting.status === "processing" && (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Processing</span>
          )}
          {meeting.status === "failed" && (
            <span className="inline-flex items-center gap-1 text-[12px] text-destructive"><TriangleAlert className="size-3" /> Failed</span>
          )}
          {meeting.tags.map((tag) => <TagPill key={tag.id} name={tag.name} color={tag.color} />)}
        </div>
        <p className="mt-0.5 truncate text-[14px] text-muted-foreground">
          {formatMeetingDateTime(meeting.started_at)} · {formatDuration(meeting.duration_ms)}
          {host && <> · {host}</>}
        </p>
      </div>

      <div className="hidden shrink-0 sm:block"><ActionItemsChip total={meeting.action_items_total} open={meeting.action_items_open} /></div>
    </Link>
  );
}
