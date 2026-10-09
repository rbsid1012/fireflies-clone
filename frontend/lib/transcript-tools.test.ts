import { describe, expect, it } from "vitest";
import {
  mentionCount,
  filterCounts, matchesFilter, segmentSentiment, sentimentCounts, splitByMatches, talkTime,
} from "./transcript-tools";
import type { TranscriptSegment } from "./types";

const seg = (id: number, text: string, extra: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  id, seq: id, start_ms: id * 1000, end_ms: id * 1000 + 800, text, participant_id: 1,
  speaker_label: "A", speaker_name: "Ann", color_index: 0, ...extra,
});

describe("splitByMatches", () => {
  it("splits around matches and numbers them", () => {
    expect(splitByMatches("we are deploying the service now", [{ start: 7, end: 16 }, { start: 21, end: 28 }])).toEqual([
      { text: "we are ", match: null }, { text: "deploying", match: 0 }, { text: " the ", match: null },
      { text: "service", match: 1 }, { text: " now", match: null },
    ]);
  });
  it("continues numbering from the first match index (matches span many lines)", () => {
    expect(splitByMatches("kafka", [{ start: 0, end: 5 }], 7)[0]).toEqual({ text: "kafka", match: 7 });
  });
  it("handles matches at the edges and no matches", () => {
    expect(splitByMatches("hi", [{ start: 0, end: 2 }])).toEqual([{ text: "hi", match: 0 }]);
    expect(splitByMatches("hello", [])).toEqual([{ text: "hello", match: null }]);
  });
  it("ignores overlapping, empty and out-of-range spans instead of corrupting the text", () => {
    const parts = splitByMatches("abcdef", [{ start: 1, end: 4 }, { start: 3, end: 5 }, { start: 5, end: 5 }, { start: 4, end: 99 }]);
    expect(parts.map((p) => p.text).join("")).toBe("abcdef");
    expect(parts.filter((p) => p.match !== null)).toHaveLength(1);
  });
  it("sorts unsorted spans", () => {
    const parts = splitByMatches("aXbYc", [{ start: 3, end: 4 }, { start: 1, end: 2 }]);
    expect(parts.filter((p) => p.match !== null).map((p) => p.text)).toEqual(["X", "Y"]);
  });
});

describe("filters", () => {
  const none = new Set<number>();
  it("finds questions", () => {
    expect(matchesFilter(seg(1, "What is the plan?"), "questions", none)).toBe(true);
    expect(matchesFilter(seg(1, "Here is the plan."), "questions", none)).toBe(false);
  });
  it("finds metrics", () => {
    for (const t of ["Revenue grew 22 percent", "That costs $5k a month", "about 40 customers", "latency was 8 seconds and 150 ms", "we have 11000 users"]) {
      expect(matchesFilter(seg(1, t), "metrics", none), t).toBe(true);
    }
    expect(matchesFilter(seg(1, "That sounds fine to me"), "metrics", none)).toBe(false);
  });
  it("finds dates and times", () => {
    for (const t of ["Let's ship it on Friday", "see you at 3 pm", "by end of the week", "in October", "the 15th works", "Q4 planning"]) {
      expect(matchesFilter(seg(1, t), "dates", none), t).toBe(true);
    }
    expect(matchesFilter(seg(1, "Nothing temporal here"), "dates", none)).toBe(false);
  });
  it("finds tasks by commitment wording or by a linked action item", () => {
    expect(matchesFilter(seg(1, "I'll send the draft tomorrow"), "tasks", none)).toBe(true);
    expect(matchesFilter(seg(2, "Mm-hm"), "tasks", none)).toBe(false);
    expect(matchesFilter(seg(2, "Mm-hm"), "tasks", new Set([2]))).toBe(true);
  });
  it("counts each filter", () => {
    const counts = filterCounts([seg(1, "Who owns it?"), seg(2, "I'll do it by Friday"), seg(3, "ok")], none);
    expect(counts).toEqual({ questions: 1, tasks: 1, metrics: 0, dates: 1 });
  });
});

describe("talkTime", () => {
  it("sums speaking time per participant, longest first, with shares that add to 1", () => {
    const rows = talkTime([
      seg(0, "a", { start_ms: 0, end_ms: 1000, participant_id: 1, speaker_name: "Ann" }),
      seg(1, "b", { start_ms: 1000, end_ms: 4000, participant_id: 2, speaker_name: "Bo", color_index: 1 }),
      seg(2, "c", { start_ms: 4000, end_ms: 5000, participant_id: 1, speaker_name: "Ann" }),
    ]);
    expect(rows.map((r) => [r.name, r.ms])).toEqual([["Bo", 3000], ["Ann", 2000]]);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    expect(rows[0].colorIndex).toBe(1);
  });
  it("groups lines without a speaker and survives an empty transcript", () => {
    expect(talkTime([seg(0, "x", { participant_id: null, speaker_name: null })])[0].name).toBe("Unknown");
    expect(talkTime([])).toEqual([]);
  });
});

describe("sentiment estimate", () => {
  it("classifies by word lists", () => {
    expect(segmentSentiment("That's great, thanks so much")).toBe("positive");
    expect(segmentSentiment("The deploy failed and it was a real problem")).toBe("negative");
    expect(segmentSentiment("We meet at noon")).toBe("neutral");
    expect(segmentSentiment("good but also a problem")).toBe("neutral"); // they cancel
  });
  it("counts across a transcript", () => {
    expect(sentimentCounts([seg(0, "great"), seg(1, "broken"), seg(2, "ok"), seg(3, "love it")])).toEqual({ positive: 2, negative: 1, neutral: 1 });
  });
});

describe("talk time words per minute and tracker counts", () => {
  const seg = (id: number, pid: number, start: number, end: number, text: string) => ({ id, seq: id, participant_id: pid, speaker_name: `P${pid}`, color_index: pid, start_ms: start, end_ms: end, text }) as never;
  it("computes words per minute from the speaking time", () => {
    const rows = talkTime([seg(1, 1, 0, 30_000, "one two three four five six seven eight nine ten"), seg(2, 2, 30_000, 40_000, "hello there")]);
    expect(rows[0]).toMatchObject({ participantId: 1, words: 10, wpm: 20 });
    expect(rows[1]).toMatchObject({ participantId: 2, words: 2, wpm: 12 });
  });
  it("counts the lines that mention a word, whole words only", () => {
    const lines = [seg(1, 1, 0, 1, "Pricing is tricky"), seg(2, 1, 1, 2, "the price list"), seg(3, 1, 2, 3, "pricing, again")];
    expect(mentionCount(lines, "pricing")).toBe(2);
    expect(mentionCount(lines, "price")).toBe(1);
    expect(mentionCount(lines, "  ")).toBe(0);
  });
});
