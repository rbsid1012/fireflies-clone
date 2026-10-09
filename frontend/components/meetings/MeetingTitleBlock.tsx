"use client";

import { Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatMeetingDateTime } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { MeetingDetail } from "@/lib/types";
import { ParticipantStack } from "./ParticipantStack";
import { TagPill } from "./TagPill";

/** Big title and the host / date / people row from the reference. */
export function MeetingTitleBlock({ meeting }: { meeting: MeetingDetail }) {
  const { user } = useAuth();
  const host = (meeting.source === "seed" ? meeting.participants[0]?.name : user?.name) ?? user?.name ?? "";
  return (
    <div className="mb-9 mt-5">
      <h1 className="text-[24px] font-normal leading-8 text-foreground">{meeting.title}</h1>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[14px] text-muted-foreground">
        <span aria-hidden="true" className="grid size-[18px] place-items-center rounded-[4px] bg-brand text-[11px] text-white">{host.charAt(0).toUpperCase() || "?"}</span>
        <span className="text-fg2 underline underline-offset-4">{host}</span>
        <span>{formatMeetingDateTime(meeting.started_at)}</span>
        {meeting.source === "upload" && <Upload className="size-3.5" strokeWidth={1.6} aria-label="Uploaded" />}
        <span>· {formatDuration(meeting.duration_ms)}</span>
        <ParticipantStack participants={meeting.participants} max={5} />
        {meeting.tags.map((t) => <TagPill key={t.id} name={t.name} color={t.color} />)}
      </div>
    </div>
  );
}
