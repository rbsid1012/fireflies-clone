import { describe, expect, it } from "vitest";
import { parseAnswer, parseInline } from "./rich-text";

describe("parseInline", () => {
  it("handles plain text", () => {
    expect(parseInline("just words")).toEqual([{ type: "text", text: "just words" }]);
  });
  it("parses bold and italic", () => {
    expect(parseInline("a **b** c _d_ e")).toEqual([
      { type: "text", text: "a " }, { type: "bold", text: "b" }, { type: "text", text: " c " },
      { type: "italic", text: "d" }, { type: "text", text: " e" },
    ]);
  });
  it("does not treat snake_case or a lone underscore as italics", () => {
    expect(parseInline("use the some_variable_name here")).toEqual([{ type: "text", text: "use the some_variable_name here" }]);
    expect(parseInline("a _ b")).toEqual([{ type: "text", text: "a _ b" }]);
  });
  it("parses single-meeting and cross-meeting citations to milliseconds", () => {
    expect(parseInline("said [03:12] and [#7 1:02:03]")).toEqual([
      { type: "text", text: "said " }, { type: "cite", label: "03:12", ms: 192_000, meetingId: null },
      { type: "text", text: " and " }, { type: "cite", label: "1:02:03", ms: 3_723_000, meetingId: 7 },
    ]);
  });
  it("leaves things that only look like citations as text", () => {
    expect(parseInline("array[1:2] and [12] and [ab:cd]")).toEqual([{ type: "text", text: "array[1:2] and [12] and [ab:cd]" }]);
  });
  it("never produces HTML: markup in the text stays as literal characters", () => {
    const parts = parseInline("<script>alert(1)</script> **<b>x</b>**");
    expect(parts[0]).toEqual({ type: "text", text: "<script>alert(1)</script> " });
    expect(parts[1]).toEqual({ type: "bold", text: "<b>x</b>" });
  });
});

describe("parseAnswer", () => {
  it("splits paragraphs and bullets and drops blank lines", () => {
    const blocks = parseAnswer("**Open action items** (2)\n• Send the doc (Ann)\n- Book the room\n\n  \nDone.");
    expect(blocks.map((b) => b.type)).toEqual(["p", "li", "li", "p"]);
    expect(blocks[1].inline).toEqual([{ type: "text", text: "Send the doc (Ann)" }]);
  });
  it("parses citations inside bullets", () => {
    const [block] = parseAnswer("• [00:30] Ann: hello");
    expect(block.type).toBe("li");
    expect(block.inline[0]).toMatchObject({ type: "cite", ms: 30_000 });
  });
  it("handles empty input", () => {
    expect(parseAnswer("")).toEqual([]);
  });
});

describe("time ranges", () => {
  it("cite the start of a range", () => {
    expect(parseInline("see [00:33-01:00] and [#7 02:06-02:30]")).toEqual([
      { type: "text", text: "see " }, { type: "cite", label: "00:33", ms: 33_000, meetingId: null },
      { type: "text", text: " and " }, { type: "cite", label: "02:06", ms: 126_000, meetingId: 7 },
    ]);
  });
});
