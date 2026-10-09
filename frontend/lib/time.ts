/** Transcript times are integer milliseconds everywhere; these are the only conversions. */

/** 83_000 -> "01:23"; 3_723_000 -> "1:02:03". Matches the backend export format. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 420_000 -> "7 min"; 3_900_000 -> "1 h 5 min". Never shows "0 min" for a non-empty meeting. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0 min";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** "1:23" / "01:02:03" / "1:23.5" -> ms, or null if it isn't a timestamp. */
export function parseTimestamp(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s, frac] = match;
  const fraction = frac ? Number(frac.padEnd(3, "0")) : 0;
  return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + fraction;
}
