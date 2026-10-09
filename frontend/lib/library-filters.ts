/**
 * The meeting library's filter state lives in the URL (so it survives refresh, can be shared,
 * and works with the back button). These helpers are the only place that knows how it is encoded.
 */

export const PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "duration", label: "Longest first" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type LibraryFilters = {
  q: string;
  participantId: number | null;
  tag: string;
  /** How the meeting was added; "upload" powers the Uploads channel. "" = any */
  source: "" | "upload" | "paste" | "seed" | "form";
  /** Inclusive start day, YYYY-MM-DD, or "" */
  from: string;
  /** Inclusive end day, YYYY-MM-DD, or "" */
  to: string;
  sort: SortKey;
  page: number;
};

export const DEFAULT_FILTERS: LibraryFilters = {
  q: "", participantId: null, tag: "", source: "", from: "", to: "", sort: "recent", page: 1,
};

type ParamsLike = { get(name: string): string | null };

const SOURCES = ["upload", "paste", "seed", "form"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE = 10_000;

function validDay(value: string | null): string {
  if (!value || !DATE_RE.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  // Rejects overflow dates such as 2026-02-31 that Date would silently roll forward
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : "";
}

function positiveInt(value: string | null): number | null {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

/** Read filters from a URL, ignoring anything malformed rather than failing. */
export function parseFilters(params: ParamsLike): LibraryFilters {
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim().slice(0, 200),
    participantId: positiveInt(params.get("participant_id")),
    tag: (params.get("tag") ?? "").trim(),
    source: SOURCES.includes(params.get("source") as never) ? (params.get("source") as LibraryFilters["source"]) : "",
    from: validDay(params.get("from")),
    to: validDay(params.get("to")),
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortKey) : "recent",
    page: Math.min(positiveInt(params.get("page")) ?? 1, MAX_PAGE),
  };
}

/** Encode filters for the URL, leaving out defaults so a clean library has a clean URL. */
export function filtersToParams(f: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.participantId !== null) params.set("participant_id", String(f.participantId));
  if (f.tag) params.set("tag", f.tag);
  if (f.source) params.set("source", f.source);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.sort !== DEFAULT_FILTERS.sort) params.set("sort", f.sort);
  if (f.page > 1) params.set("page", String(f.page));
  return params;
}

/** Query for GET /api/meetings. Empty values are dropped by the API client. */
export function toApiQuery(f: LibraryFilters) {
  return {
    q: f.q, participant_id: f.participantId, tag: f.tag, source: f.source, from: f.from, to: f.to,
    sort: f.sort, page: f.page, limit: PAGE_SIZE,
  };
}

/** Apply a change. Any change other than paging itself returns to page 1. */
export function withFilters(current: LibraryFilters, patch: Partial<LibraryFilters>): LibraryFilters {
  return { ...current, ...patch, page: patch.page ?? 1 };
}

/** Number of narrowing filters (sort and page don't narrow). */
export function activeFilterCount(f: LibraryFilters): number {
  return [f.q, f.participantId !== null, f.tag, f.from, f.to].filter(Boolean).length;
}

export function clearFilters(f: LibraryFilters): LibraryFilters {
  return { ...DEFAULT_FILTERS, sort: f.sort };
}
