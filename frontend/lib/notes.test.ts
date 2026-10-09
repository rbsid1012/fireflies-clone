import { describe, expect, it } from "vitest";
import { momentFor, parseNotes, sentences } from "./notes";

const chapter = (start: number) => ({ id: 1, seq: 0, title: "t", start_ms: start, summary: null }) as never;
const seg = (id: number, start: number, text: string) => ({ id, seq: id, start_ms: start, end_ms: start + 1000, text, participant_id: 1, speaker_name: "A", color_index: 0 }) as never;

describe("notes", () => {
  it("splits a summary into bullets", () => {
    expect(sentences("One thing. Two things! Three?")).toEqual(["One thing.", "Two things!", "Three?"]);
    expect(sentences(null)).toEqual([]);
  });
  it("links a note to the line it came from, inside its chapter", () => {
    const lines = [seg(1, 0, "Welcome everyone"), seg(2, 10_000, "The crash rate is down to point four percent"), seg(3, 40_000, "Crash rate again in another chapter")];
    expect(momentFor("Crash rate is 0.4%", chapter(0), chapter(30_000), lines)).toBe(10_000);
    expect(momentFor("Totally unrelated words here", chapter(0), chapter(30_000), lines)).toBe(0);
  });
  it("reads stored notes with nested details and the moment each point came from", () => {
    const notes = parseNotes("- Beta launch delayed to October 23rd {@45000}\n  - Crash rate 0.4%\n  - Push bug unresolved\n- Fix by Wednesday");
    expect(notes).toEqual([
      { text: "Beta launch delayed to October 23rd", ms: 45_000, subs: ["Crash rate 0.4%", "Push bug unresolved"] },
      { text: "Fix by Wednesday", ms: null, subs: [] },
    ]);
  });
  it("still reads plain prose from older meetings", () => {
    expect(parseNotes("One thing. Two things.").map((p) => p.text)).toEqual(["One thing.", "Two things."]);
    expect(parseNotes(null)).toEqual([]);
  });
});
