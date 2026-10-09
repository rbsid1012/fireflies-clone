"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { EmailLog } from "@/lib/types";

const SEEN_KEY = "ff_notifications_seen";

function readSeen(): number {
  try { return Number(window.localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}

/** Notifications are the emails this app sent you (meeting recaps, welcome), newest first. */
export function NotificationsBell() {
  const [seen, setSeen] = useState(readSeen);
  const emails = useQuery({ queryKey: ["emails", "bell"], queryFn: () => api.get<EmailLog[]>("/api/emails"), staleTime: 30_000, refetchInterval: 60_000 });
  const items = (emails.data ?? []).slice(0, 8);
  const newest = items.length ? new Date(items[0].created_at).getTime() : 0;
  const unread = newest > seen;

  const markSeen = (open: boolean) => {
    if (!open || !newest) return;
    try { window.localStorage.setItem(SEEN_KEY, String(newest)); } catch { /* the dot just comes back next time */ }
    setSeen(newest);
  };

  return (
    <Popover onOpenChange={markSeen}>
      <PopoverTrigger
        aria-label={unread ? "Notifications (new)" : "Notifications"}
        className="relative grid size-8 place-items-center rounded-md text-fg2 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Bell className="size-[18px]" strokeWidth={1.5} />
        {unread && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#e5533d]" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <p className="border-b px-4 py-3 text-[14px] font-medium">Notifications</p>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing yet. A recap email shows up here after each meeting you add.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((m) => (
              <li key={m.id}>
                <Link href={m.meeting_id ? `/meetings/${m.meeting_id}` : "/settings/recording-privacy"} className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{m.subject}</span>
                    <span className="block text-[12px] text-muted-foreground">{formatMeetingDateTime(m.created_at)} · {m.status === "sent" ? "sent" : m.status === "logged" ? "saved to outbox" : m.status}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/settings/recording-privacy" className="border-t px-4 py-2.5 text-center text-[13px] text-muted-foreground hover:text-foreground">Open email outbox</Link>
      </PopoverContent>
    </Popover>
  );
}
