import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS, activeFilterCount, clearFilters, filtersToParams, parseFilters, toApiQuery, withFilters,
} from "./library-filters";

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe("parseFilters", () => {
  it("returns defaults for an empty URL", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter", () => {
    expect(parse("q=kafka&participant_id=4&tag=sales&from=2026-10-01&to=2026-10-05&sort=title&page=3")).toEqual({
      q: "kafka", participantId: 4, tag: "sales", source: "", from: "2026-10-01", to: "2026-10-05", sort: "title", page: 3,
    });
  });

  it("ignores malformed values instead of failing", () => {
    expect(parse("participant_id=abc&sort=bogus&page=-2&from=yesterday&to=2026-02-31")).toEqual(DEFAULT_FILTERS);
    expect(parse("participant_id=0&page=0").participantId).toBeNull();
    expect(parse("page=1.5").page).toBe(1);
  });

  it("trims and bounds text and caps the page", () => {
    expect(parse("q=%20%20hello%20%20").q).toBe("hello");
    expect(parse(`q=${"x".repeat(500)}`).q).toHaveLength(200);
    expect(parse("page=99999999").page).toBe(10_000);
  });
});

describe("filtersToParams", () => {
  it("omits defaults so a clean library has a clean URL", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("round-trips through the URL", () => {
    const filters = { q: "fail open", participantId: 7, tag: "q4 launch", source: "" as const, from: "2026-09-01", to: "", sort: "duration" as const, page: 2 };
    expect(parseFilters(filtersToParams(filters))).toEqual(filters);
  });

  it("keeps the default sort out of the URL but not the others", () => {
    expect(filtersToParams({ ...DEFAULT_FILTERS, sort: "recent" }).has("sort")).toBe(false);
    expect(filtersToParams({ ...DEFAULT_FILTERS, sort: "oldest" }).get("sort")).toBe("oldest");
  });
});

describe("toApiQuery", () => {
  it("maps to the backend's parameter names", () => {
    expect(toApiQuery({ ...DEFAULT_FILTERS, participantId: 3, from: "2026-10-01", page: 2 })).toMatchObject({
      participant_id: 3, from: "2026-10-01", page: 2, limit: 20, sort: "recent",
    });
  });
});

describe("withFilters / clearFilters / activeFilterCount", () => {
  it("returns to page 1 whenever something other than the page changes", () => {
    const onPage3 = { ...DEFAULT_FILTERS, page: 3 };
    expect(withFilters(onPage3, { tag: "sales" }).page).toBe(1);
    expect(withFilters(onPage3, { page: 4 }).page).toBe(4);
  });

  it("counts only narrowing filters", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: "title", page: 5 })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: "x", tag: "y", participantId: 1, from: "2026-01-01" })).toBe(4);
  });

  it("clearing keeps the chosen sort", () => {
    expect(clearFilters({ ...DEFAULT_FILTERS, q: "x", tag: "y", sort: "title", page: 2 })).toEqual({ ...DEFAULT_FILTERS, sort: "title" });
  });
});

describe("source filter", () => {
  it("is read from the URL, ignores unknown values, and is written back", () => {
    expect(parseFilters(new URLSearchParams("source=upload")).source).toBe("upload");
    expect(parseFilters(new URLSearchParams("source=bogus")).source).toBe("");
    expect(filtersToParams({ ...DEFAULT_FILTERS, source: "upload" }).toString()).toBe("source=upload");
    expect(toApiQuery({ ...DEFAULT_FILTERS, source: "upload" }).source).toBe("upload");
  });
});
