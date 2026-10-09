import type { MeetingListItem } from "./types";
import { dayLabel } from "./dates";

export type MeetingGroup = { label: string; items: MeetingListItem[] };

/** Group an already-sorted list into consecutive day sections ("Today", "Yesterday", ...). */
export function groupByDay(items: MeetingListItem[], now: Date = new Date()): MeetingGroup[] {
  const groups: MeetingGroup[] = [];
  for (const item of items) {
    const label = dayLabel(new Date(item.started_at), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
