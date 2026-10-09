const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekdayMonthDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** Newer ICU versions put a narrow no-break space before AM/PM; normalise it to a plain space. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

/** "Oct 9 · 3:12 AM" in the viewer's time zone. */
export function formatMeetingDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return plain(`${monthDay.format(d)} · ${time.format(d)}`);
}

/** "2026-10-01" -> "Oct 1, 2026" (the day is read as a calendar day, not shifted by time zone). */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayFormat.format(new Date(y, m - 1, d));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday", "Tue, Oct 6", or "Oct 6, 2025" for another year. Calendar days in local time. */
export function dayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.getFullYear() === now.getFullYear() ? weekdayMonthDay.format(date) : dayFormat.format(date);
}
