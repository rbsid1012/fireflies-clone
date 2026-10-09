/**
 * Answers from Fred use a tiny markup: **bold**, _italic_, "• " bullets and [mm:ss] / [#meetingId mm:ss]
 * citations. We parse it into data and render it with React, never as HTML, so model output or
 * transcript text can't inject markup.
 */
import { parseTimestamp } from "./time";

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "cite"; label: string; ms: number; meetingId: number | null };

export type Block = { type: "p" | "li"; inline: Inline[] };

const TOKEN = /\*\*(.+?)\*\*|(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w])|\[#(\d+) (\d{1,2}:\d{2}(?::\d{2})?)(?:\s?-\s?\d{1,2}:\d{2}(?::\d{2})?)?\]|\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s?-\s?\d{1,2}:\d{2}(?::\d{2})?)?\]/g;

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let cursor = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > cursor) out.push({ type: "text", text: line.slice(cursor, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "italic", text: m[2] });
    else if (m[4] !== undefined) {
      const ms = parseTimestamp(m[4]);
      if (ms !== null) out.push({ type: "cite", label: m[4], ms, meetingId: Number(m[3]) });
      else out.push({ type: "text", text: m[0] });
    } else {
      const ms = parseTimestamp(m[5]);
      if (ms !== null) out.push({ type: "cite", label: m[5], ms, meetingId: null });
      else out.push({ type: "text", text: m[0] });
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < line.length) out.push({ type: "text", text: line.slice(cursor) });
  return out;
}

export function parseAnswer(text: string): Block[] {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const bullet = /^\s*(?:•|-|\*)\s+(.*)$/.exec(line);
      return bullet ? { type: "li" as const, inline: parseInline(bullet[1]) } : { type: "p" as const, inline: parseInline(line.trim()) };
    });
}
