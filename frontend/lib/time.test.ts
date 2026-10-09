import { describe, expect, it } from "vitest";
import { formatDuration, formatTimestamp, parseTimestamp } from "./time";

describe("formatTimestamp", () => {
  it("formats under an hour as mm:ss", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(83_000)).toBe("01:23");
    expect(formatTimestamp(3_599_999)).toBe("59:59");
  });
  it("adds hours from one hour up", () => {
    expect(formatTimestamp(3_600_000)).toBe("1:00:00");
    expect(formatTimestamp(3_723_000)).toBe("1:02:03");
  });
  it("truncates sub-second precision and clamps negatives", () => {
    expect(formatTimestamp(999)).toBe("00:00");
    expect(formatTimestamp(1_999)).toBe("00:01");
    expect(formatTimestamp(-5_000)).toBe("00:00");
  });
});

describe("formatDuration", () => {
  it("rounds to minutes with a one-minute floor", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(20_000)).toBe("1 min");
    expect(formatDuration(420_000)).toBe("7 min");
  });
  it("splits hours", () => {
    expect(formatDuration(3_600_000)).toBe("1 h 0 min");
    expect(formatDuration(3_900_000)).toBe("1 h 5 min");
  });
});

describe("parseTimestamp", () => {
  it("parses mm:ss, h:mm:ss and fractions", () => {
    expect(parseTimestamp("1:23")).toBe(83_000);
    expect(parseTimestamp("01:02:03")).toBe(3_723_000);
    expect(parseTimestamp("0:05.5")).toBe(5_500);
    expect(parseTimestamp("0:05,25")).toBe(5_250);
  });
  it("rejects non-timestamps", () => {
    for (const bad of ["", "abc", "12", "1:2", "1:234", "1:23:4"]) expect(parseTimestamp(bad)).toBeNull();
  });
  it("round-trips with formatTimestamp", () => {
    for (const ms of [0, 1_000, 59_000, 83_000, 3_723_000]) {
      expect(parseTimestamp(formatTimestamp(ms))).toBe(ms);
    }
  });
});
