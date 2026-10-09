import type { Chapter, TranscriptSegment } from "./types";

/** Split prose into note bullets. */
export function sentences(text: string | null): string[] {
  return (text ?? "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export interface NotePoint { text: string; ms: number | null; subs: string[] }

const MARK = /\s*\{@(\d+)\}\s*$/;

/**
 * A chapter's notes. The backend stores an indented bullet list ("- point {@ms}" with "  - detail" under it);
 * older meetings hold plain prose, where each sentence becomes a point. Mirrors app/services/notes_format.py.
 */
export function parseNotes(summary: string | null): NotePoint[] {
  const points: NotePoint[] = [];
  for (const raw of (summary ?? "").split("\n")) {
    if (!raw.trim()) continue;
    const m = /^(\s*)[-•○*]\s+(.*)$/.exec(raw);
    if (!m) { points.push(...sentences(raw).map((text) => ({ text, ms: null, subs: [] }))); continue; }
    const text = m[2].trim();
    if (m[1] && points.length) { points[points.length - 1].subs.push(text.replace(MARK, "")); continue; }
    const mark = MARK.exec(text);
    points.push({ text: text.replace(MARK, ""), ms: mark ? Number(mark[1]) : null, subs: [] });
  }
  return points;
}

const STOP = new Set("that this with have from they them were what when will would there their about which into your been than then also just very more some such like over only other could should".split(" "));
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []).filter((w) => !STOP.has(w)));

/**
 * The moment in the transcript a note was written from: the line (inside the chapter) that shares the most
 * words with it. Falls back to the chapter's start, so a bullet always links somewhere real.
 */
export function momentFor(note: string, chapter: Chapter, next: Chapter | undefined, segments: TranscriptSegment[]): number {
  const target = words(note);
  let best = chapter.start_ms;
  let score = 0;
  for (const s of segments) {
    if (s.start_ms < chapter.start_ms || (next && s.start_ms >= next.start_ms)) continue;
    let overlap = 0;
    for (const w of words(s.text)) if (target.has(w)) overlap++;
    if (overlap > score) { score = overlap; best = s.start_ms; }
  }
  return best;
}
