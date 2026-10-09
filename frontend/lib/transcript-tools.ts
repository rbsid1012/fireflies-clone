/** Small, pure helpers for working with a transcript in the browser. */
import type { TranscriptSegment } from "./types";

// ---------------------------------------------------------------- highlighting search matches

export type TextPart = { text: string; match: number | null };

/**
 * Split text into plain and matched runs. `spans` are character offsets from the API (end exclusive);
 * `firstMatchIndex` numbers the matches so the "current" one can be styled differently.
 */
export function splitByMatches(text: string, spans: { start: number; end: number }[], firstMatchIndex = 0): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  let n = firstMatchIndex;
  for (const { start, end } of [...spans].sort((a, b) => a.start - b.start)) {
    if (start < cursor || end > text.length || end <= start) continue; // skip overlaps and out-of-range spans
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: null });
    parts.push({ text: text.slice(start, end), match: n++ });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: null });
  return parts.length ? parts : [{ text, match: null }];
}

// ---------------------------------------------------------------- AI filters

export type FilterKey = "questions" | "tasks" | "metrics" | "dates";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "questions", label: "Questions" },
  { key: "tasks", label: "Tasks" },
  { key: "metrics", label: "Metrics" },
  { key: "dates", label: "Dates & times" },
];

const METRIC = /(\$\s?\d|\d[\d,.]*\s?(%|percent|k\b|m\b|million|billion|x\b|ms\b|hours?|minutes?|days?|weeks?|users?|customers?|tickets?)|\b\d{2,}\b)/i;
const DATE = /\b(today|tomorrow|yesterday|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next (week|month|quarter)|end of (the )?(day|week|month|quarter)|january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}(st|nd|rd|th)\b|eod|eow)\b/i;
const COMMITMENT = /\b(i'll|i will|i'm going to|we need to|we should|can you|could you|let's|action item|follow up|make sure|by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of))\b/i;

/** Which transcript lines each filter would show. `taskSegmentIds` are lines already linked to action items. */
export function matchesFilter(segment: TranscriptSegment, key: FilterKey, taskSegmentIds: ReadonlySet<number>): boolean {
  switch (key) {
    case "questions": return segment.text.includes("?");
    case "tasks": return taskSegmentIds.has(segment.id) || COMMITMENT.test(segment.text);
    case "metrics": return METRIC.test(segment.text);
    case "dates": return DATE.test(segment.text);
  }
}

export function filterCounts(segments: TranscriptSegment[], taskSegmentIds: ReadonlySet<number>): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = { questions: 0, tasks: 0, metrics: 0, dates: 0 };
  for (const s of segments) for (const f of FILTERS) if (matchesFilter(s, f.key, taskSegmentIds)) counts[f.key]++;
  return counts;
}

// ---------------------------------------------------------------- talk time

export type TalkShare = { participantId: number | null; name: string; colorIndex: number; ms: number; share: number; words: number; wpm: number };

/** Speaking time per participant, longest first. Unattributed lines are grouped as "Unknown". */
export function talkTime(segments: TranscriptSegment[]): TalkShare[] {
  const byId = new Map<number | null, TalkShare>();
  let total = 0;
  for (const s of segments) {
    const ms = Math.max(0, s.end_ms - s.start_ms);
    total += ms;
    const row = byId.get(s.participant_id) ?? { participantId: s.participant_id, name: s.speaker_name ?? "Unknown", colorIndex: s.color_index, ms: 0, share: 0, words: 0, wpm: 0 };
    row.ms += ms;
    row.words += s.text.trim().split(/\s+/).filter(Boolean).length;
    byId.set(s.participant_id, row);
  }
  return [...byId.values()].map((r) => ({ ...r, share: total ? r.ms / total : 0, wpm: r.ms > 0 ? Math.round(r.words / (r.ms / 60_000)) : 0 })).sort((a, b) => b.ms - a.ms);
}

/** How many lines mention `word` (whole word, any case): the count shown on a topic tracker. */
export function mentionCount(segments: TranscriptSegment[], word: string): number {
  const needle = word.trim().toLowerCase();
  if (!needle) return 0;
  const rx = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
  return segments.filter((s) => rx.test(s.text)).length;
}

// ---------------------------------------------------------------- sentiment (a rough, word-list estimate)

export type Sentiment = "positive" | "negative" | "neutral";

const POSITIVE = new Set("great good love loved excellent amazing awesome perfect happy glad excited thanks thank helpful nice agree agreed wonderful fantastic win won success successful strong improved improve better best easy clear smooth pleased appreciate fun brilliant".split(" "));
const NEGATIVE = new Set("bad worse worst problem issue issues broke broken fail failed failure wrong slow delay delayed delays risk risks concern concerned worried blocker blocked confusing difficult hard angry upset annoying lost missed late outage incident bug bugs crash painful stuck unhappy complaint complaints".split(" "));

/** Positive and negative words cancel out; ties are neutral. Crude, so the UI labels it an estimate. */
export function segmentSentiment(text: string): Sentiment {
  let score = 0;
  for (const word of text.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (POSITIVE.has(word)) score++;
    else if (NEGATIVE.has(word)) score--;
  }
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
}

export function sentimentCounts(segments: TranscriptSegment[]): Record<Sentiment, number> {
  const counts: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const s of segments) counts[segmentSentiment(s.text)]++;
  return counts;
}
