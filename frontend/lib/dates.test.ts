import { describe, expect, it } from "vitest";
import { dayLabel, formatDay, formatMeetingDateTime } from "./dates";
import { groupByDay } from "./group-meetings";
import type { MeetingListItem } from "./types";

// Dates are built from local components so the tests pass in any time zone.
const now = new Date(2026, 9, 9, 12, 0); // Fri Oct 9 2026

describe("dayLabel", () => {
  it("labels today and yesterday", () => {
    expect(dayLabel(new Date(2026, 9, 9, 0, 5), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 9, 23, 59), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 8, 23, 59), now)).toBe("Yesterday");
  });
  it("uses weekday and date for other days this year", () => {
    expect(dayLabel(new Date(2026, 9, 6, 9, 30), now)).toBe("Tue, Oct 6");
  });
  it("adds the year for other years", () => {
    expect(dayLabel(new Date(2025, 11, 31), now)).toBe("Dec 31, 2025");
  });
  it("handles month boundaries for yesterday", () => {
    expect(dayLabel(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe("Yesterday");
  });
});

describe("formatters", () => {
  it("formats a meeting time without odd unicode spaces", () => {
    const text = formatMeetingDateTime(new Date(2026, 9, 9, 15, 12));
    expect(text).toBe("Oct 9 · 3:12 PM");
    expect(text).not.toMatch(/[  ]/);
  });
  it("formats a calendar day without shifting it across time zones", () => {
    expect(formatDay("2026-10-01")).toBe("Oct 1, 2026");
    expect(formatDay("2026-12-31")).toBe("Dec 31, 2026");
  });
});

describe("groupByDay", () => {
  const item = (id: number, d: Date) => ({ id, started_at: d.toISOString() }) as MeetingListItem;

  it("groups consecutive meetings on the same day, preserving order", () => {
    const groups = groupByDay(
      [item(1, new Date(2026, 9, 9, 10)), item(2, new Date(2026, 9, 9, 8)), item(3, new Date(2026, 9, 8, 17)), item(4, new Date(2026, 9, 1, 9))],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Today", [1, 2]], ["Yesterday", [3]], ["Thu, Oct 1", [4]],
    ]);
  });

  it("returns no groups for no meetings", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
