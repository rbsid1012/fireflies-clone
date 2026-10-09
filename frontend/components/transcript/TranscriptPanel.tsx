"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranscriptSearch } from "@/hooks/useMeeting";
import { useSoundbites } from "@/hooks/useSoundbites";
import {
  filterCounts, matchesFilter, segmentSentiment, sentimentCounts, splitByMatches, talkTime,
  type FilterKey, type Sentiment, type TextPart,
} from "@/lib/transcript-tools";
import type { TranscriptSegment } from "@/lib/types";
import { useActiveIndex, usePlayer, usePlayerState } from "@/components/player/PlayerProvider";
import { Insights } from "./Insights";
import { TranscriptLine } from "./TranscriptLine";
import { TranscriptSearch } from "./TranscriptSearch";

type Props = {
  meetingId: number;
  segments: TranscriptSegment[];
  keywords: string[];
  /** Segments that an action item points at (they count as "tasks" for the filter). */
  taskSegmentIds: ReadonlySet<number>;
  query: string;
  onQueryChange: (q: string) => void;
  /** Which rail tab is showing: the search + sections + lines, the sections alone, or the lines alone */
  mode?: "search" | "insights" | "transcript";
  onIdentify?: () => void;
  identifying?: boolean;
};

const FILTER_LABELS: Record<FilterKey, string> = { questions: "Questions", tasks: "Tasks", metrics: "Metrics", dates: "Date & Time" };
const TITLES = { search: "Smart Search", insights: "Insights", transcript: "Transcript" } as const;

export function TranscriptPanel({ meetingId, segments, keywords, taskSegmentIds, query, onQueryChange, mode = "search", onIdentify, identifying }: Props) {
  const player = usePlayer();
  const { playing } = usePlayerState();
  const listRef = useRef<HTMLDivElement>(null);

  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  const activeIndex = useActiveIndex(starts);
  const activeSeq = activeIndex >= 0 ? segments[activeIndex].seq : -1;

  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [speaker, setSpeaker] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [jump, setJump] = useState<{ seq: number; nonce: number } | null>(null);

  // ---- derived data ---------------------------------------------------------------------------
  const counts = useMemo(() => filterCounts(segments, taskSegmentIds), [segments, taskSegmentIds]);
  const sentiments = useMemo(() => sentimentCounts(segments), [segments]);
  const talk = useMemo(() => talkTime(segments), [segments]);

  const visible = useMemo(
    () => segments.filter((s) =>
      (filter === null || matchesFilter(s, filter, taskSegmentIds)) &&
      (sentiment === null || segmentSentiment(s.text) === sentiment) &&
      (speaker === null || s.participant_id === speaker)),
    [segments, filter, sentiment, speaker, taskSegmentIds],
  );
  const filtersActive = filter !== null || sentiment !== null || speaker !== null;
  // Smart Search shows the insights; the lines appear once you search or pick a filter (the Transcript tab always shows them)
  const showList = mode === "transcript" || query.trim() !== "" || filtersActive;
  const showInsights = mode !== "transcript" && !showList;

  // ---- search ---------------------------------------------------------------------------------
  const debouncedQuery = useDebouncedValue(query, 250).trim();
  const search = useTranscriptSearch(meetingId, debouncedQuery);
  const searching = query.trim() !== debouncedQuery || (debouncedQuery !== "" && search.isFetching && !search.data);
  const matches = useMemo(() => (debouncedQuery && search.data ? search.data.segments : []), [debouncedQuery, search.data]);
  const total = debouncedQuery && search.data ? search.data.total_matches : 0;
  const safeCursor = total ? Math.min(cursor, total - 1) : 0;

  /** Per-line highlight data: which character ranges, and the number of the line's first match. */
  const partsBySeg = useMemo(() => {
    const byId = new Map<number, TextPart[]>();
    const bySegId = new Map(segments.map((s) => [s.id, s]));
    let n = 0;
    for (const m of matches) {
      const seg = bySegId.get(m.segment_id);
      if (!seg) { continue; }
      byId.set(m.segment_id, splitByMatches(seg.text, m.matches, n));
      n += m.matches.length;
    }
    return byId;
  }, [matches, segments]);

  /** The segment each numbered match lives in, in order. */
  const matchOwners = useMemo(() => matches.flatMap((m) => m.matches.map(() => m.seq)), [matches]);

  const clearFilters = () => { setFilter(null); setSentiment(null); setSpeaker(null); };

  const step = useCallback((direction: 1 | -1) => {
    if (!total) return;
    const next = (safeCursor + direction + total) % total;
    setCursor(next);
    setAutoScroll(false); // otherwise playback would drag the view away from the match
    clearFilters();
    setJump((j) => ({ seq: matchOwners[next], nonce: (j?.nonce ?? 0) + 1 }));
  }, [safeCursor, total, matchOwners]);

  // A new set of results starts at its first match (state adjusted during render, not in an effect)
  const resultsKey = `${debouncedQuery}|${search.dataUpdatedAt}`;
  const [seenKey, setSeenKey] = useState(resultsKey);
  if (seenKey !== resultsKey) {
    setSeenKey(resultsKey);
    setCursor(0);
    if (matchOwners.length) {
      setAutoScroll(false);
      setJump((j) => ({ seq: matchOwners[0], nonce: (j?.nonce ?? 0) + 1 }));
    }
  }

  // ---- scrolling ------------------------------------------------------------------------------
  const scrollToSeq = useCallback((seq: number, smooth: boolean) => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-seq="${seq}"]`);
    if (!list || !el) return;
    list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => { if (jump) requestAnimationFrame(() => scrollToSeq(jump.seq, true)); }, [jump, scrollToSeq]);

  // Follow playback while auto-scroll is on
  useEffect(() => {
    if (autoScroll && activeSeq >= 0) scrollToSeq(activeSeq, true);
  }, [activeSeq, autoScroll, scrollToSeq]);

  const pauseAutoScroll = () => setAutoScroll(false); // wheel/touch/keys only fire for the *user*, never for scrollTo

  const { soundbites, create: createSoundbite } = useSoundbites(meetingId);
  const savedSeqs = useMemo(() => {
    const bySegmentId = new Map(segments.map((s) => [s.id, s.seq]));
    const seqs = new Set<number>();
    for (const sb of soundbites) {
      const from = bySegmentId.get(sb.start_segment_id), to = bySegmentId.get(sb.end_segment_id);
      if (from !== undefined && to !== undefined) for (let q = from; q <= to; q++) seqs.add(q);
    }
    return seqs;
  }, [soundbites, segments]);
  const saveSoundbite = useCallback((segment: TranscriptSegment) => createSoundbite.mutate({ start_segment_id: segment.id }), [createSoundbite]);

  const onSeek = useCallback((ms: number) => {
    player?.seek(ms);
    player?.play();
    setAutoScroll(true);
  }, [player]);

  const currentSeq = matchOwners[safeCursor];
  const currentMatchNumber = safeCursor;

  return (
    <section aria-label={TITLES[mode]} className="flex h-full min-h-0 flex-col">
      <h2 className="flex h-[51px] shrink-0 items-center border-b border-border px-[18px] text-[14px] text-foreground">{TITLES[mode]}</h2>
      {mode !== "insights" && (
        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <TranscriptSearch value={query} onChange={onQueryChange} total={searching ? null : total} current={safeCursor} onStep={step} />
        </div>
      )}
      {showInsights && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Insights
            segments={segments} onIdentify={onIdentify} identifying={identifying}
            filterCounts={counts} filter={filter} onFilter={setFilter}
            sentimentCounts={sentiments} sentiment={sentiment} onSentiment={setSentiment}
            talk={talk} speaker={speaker} onSpeaker={setSpeaker}
            topics={keywords} onTopic={(k) => onQueryChange(k)}
          />
        </div>
      )}

      {showList && filtersActive && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-[13px]">
          <span className="text-fg3">Showing</span>
          {filter && <span className="inline-flex items-center gap-1 rounded-full bg-iris-chip px-2.5 py-0.5 text-iris">{FILTER_LABELS[filter]}</span>}
          {sentiment && <span className="inline-flex items-center gap-1 rounded-full bg-iris-chip px-2.5 py-0.5 text-iris">{sentiment}</span>}
          {speaker !== null && <span className="inline-flex items-center gap-1 rounded-full bg-iris-chip px-2.5 py-0.5 text-iris">{talk.find((t) => t.participantId === speaker)?.name ?? "Speaker"}</span>}
          <button type="button" onClick={clearFilters} className="ml-auto text-fg3 underline underline-offset-4 hover:text-foreground">Clear</button>
        </div>
      )}

      {showList && <div className="relative min-h-0 flex-1">
        <div
          ref={listRef} tabIndex={-1} onWheel={pauseAutoScroll} onTouchMove={pauseAutoScroll}
          onKeyDown={(e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) pauseAutoScroll(); }}
          className="relative h-full overflow-y-auto px-2 py-2"
        >
          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX} title="No lines match" description="Try a different filter." className="py-12"
              action={filtersActive ? <Button variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          ) : (
            visible.map((s) => (
              <TranscriptLine
                key={s.id} segment={s} active={s.seq === activeSeq} onSeek={onSeek}
                saved={savedSeqs.has(s.seq)} onSave={saveSoundbite}
                parts={partsBySeg.get(s.id) ?? null}
                currentMatch={s.seq === currentSeq ? currentMatchNumber : -1}
              />
            ))
          )}
        </div>
        {!autoScroll && activeSeq >= 0 && (
          <button
            type="button" onClick={() => { setAutoScroll(true); scrollToSeq(activeSeq, true); }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            <ArrowDownToLine className="size-4" /> {playing ? "Resume auto-scroll" : "Jump to current line"}
          </button>
        )}
      </div>}
    </section>
  );
}
