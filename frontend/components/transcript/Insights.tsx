"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Hash, Loader2, Plus, Users, Wand2, X } from "lucide-react";
import { useTrackers } from "@/hooks/useTrackers";
import { mentionCount, type FilterKey, type Sentiment, type TalkShare } from "@/lib/transcript-tools";
import type { TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { speakerColorClass } from "./SpeakerAvatar";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border">
      <div className="flex h-[52px] items-center gap-2 px-[18px]">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-full flex-1 items-center text-left text-[12px] uppercase tracking-[0.04em] text-fg3 transition-colors hover:text-foreground">{title}</button>
        {action}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} className="grid size-6 place-items-center text-fg3 hover:text-foreground">
          {open ? <ChevronUp className="size-4" strokeWidth={1.5} /> : <ChevronDown className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
      {open && <div className="px-[18px] pb-5">{children}</div>}
    </div>
  );
}

const FILTER_STYLE: Record<FilterKey, { label: string; dot: string }> = {
  dates: { label: "Date & Time", dot: "bg-sky-400" },
  metrics: { label: "Metrics", dot: "bg-teal-400" },
  questions: { label: "Questions", dot: "bg-rose-400" },
  tasks: { label: "Tasks", dot: "bg-amber-400" },
};
const FILTER_ORDER: FilterKey[] = ["dates", "metrics", "questions", "tasks"];

const SENTIMENT_STYLE: Record<Sentiment, { label: string; dot: string }> = {
  positive: { label: "Positive", dot: "bg-sky-400" },
  neutral: { label: "Neutral", dot: "bg-rose-400" },
  negative: { label: "Negative", dot: "bg-amber-500" },
};

const card = (active: boolean) =>
  cn("flex h-[34px] items-center gap-2.5 rounded-md border px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
    active ? "border-iris bg-iris-chip text-foreground" : "border-border bg-card text-fg2 hover:bg-muted/60");

function Ring({ pct }: { pct: number }) {
  return <span aria-hidden="true" className="relative grid size-5 place-items-center rounded-full" style={{ background: `conic-gradient(var(--iris) ${pct * 3.6}deg, var(--muted) 0)` }}><span className="size-3 rounded-full bg-card" /></span>;
}

type Props = {
  segments: TranscriptSegment[];
  filterCounts: Record<FilterKey, number>;
  filter: FilterKey | null;
  onFilter: (key: FilterKey | null) => void;
  sentimentCounts: Record<Sentiment, number>;
  sentiment: Sentiment | null;
  onSentiment: (s: Sentiment | null) => void;
  talk: TalkShare[];
  speaker: number | null;
  onSpeaker: (participantId: number | null) => void;
  /** Keywords the meeting summary found */
  topics: string[];
  onTopic: (keyword: string) => void;
  /** Re-label lines by who said them (shown while only one generic speaker exists) */
  onIdentify?: () => void;
  identifying?: boolean;
};

/** The sections of the Smart Search panel: filters, sentiment, who talked how much, and topic trackers. */
export function Insights(p: Props) {
  const totalSentiment = p.sentimentCounts.positive + p.sentimentCounts.neutral + p.sentimentCounts.negative || 1;
  const trackers = useTrackers();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const tracked = [...new Set([...p.topics.map((t) => t.toLowerCase()), ...trackers.words])];
  const onlyGeneric = p.talk.length <= 1 && !!p.onIdentify;

  return (
    <div className="shrink-0">
      <Section title="AI filters">
        <div className="grid grid-cols-2 gap-2">
          {FILTER_ORDER.map((key) => (
            <button key={key} type="button" aria-pressed={p.filter === key} onClick={() => p.onFilter(p.filter === key ? null : key)} className={card(p.filter === key)}>
              <span className={cn("size-1.5 rounded-full", FILTER_STYLE[key].dot)} /> {FILTER_STYLE[key].label}
              <span className="ml-auto text-[12px] tabular-nums text-fg3">{p.filterCounts[key]}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sentiments">
        <div className="space-y-2">
          {(Object.keys(SENTIMENT_STYLE) as Sentiment[]).map((s) => (
            <button key={s} type="button" aria-pressed={p.sentiment === s} onClick={() => p.onSentiment(p.sentiment === s ? null : s)} className={cn(card(p.sentiment === s), "w-full")}>
              <span className={cn("size-1.5 rounded-full", SENTIMENT_STYLE[s].dot)} /> {SENTIMENT_STYLE[s].label}
              <span className="ml-auto text-[12px] tabular-nums text-fg3">{Math.round((p.sentimentCounts[s] / totalSentiment) * 100)}%</span>
            </button>
          ))}
          <p className="pt-1 text-[12px] text-fg3">A rough estimate from the words used.</p>
        </div>
      </Section>

      <Section title="Speaker talktime">
        <div className="mb-2 grid grid-cols-[1fr_64px_88px] px-3 text-[11px] uppercase tracking-[0.04em] text-fg3"><span>Speakers</span><span>WPM</span><span>Talktime</span></div>
        <ul className="space-y-2">
          {p.talk.map((t) => (
            <li key={t.participantId ?? "none"}>
              <button type="button" aria-pressed={p.speaker === t.participantId} onClick={() => p.onSpeaker(p.speaker === t.participantId ? null : t.participantId)} className={cn(card(p.speaker === t.participantId), "grid h-11 w-full grid-cols-[1fr_64px_88px] gap-0")}>
                <span className="flex min-w-0 items-center gap-2.5"><span className={cn("grid size-6 shrink-0 place-items-center rounded-[5px] text-[12px] text-black/75", speakerColorClass(t.colorIndex))}>{t.name.charAt(0).toUpperCase()}</span><span className="truncate text-foreground">{t.name}</span></span>
                <span className="flex items-center gap-1.5 tabular-nums"><span className="size-1.5 rounded-full bg-rose-300" />{t.wpm}</span>
                <span className="flex items-center gap-2 tabular-nums"><Ring pct={t.share * 100} />{Math.round(t.share * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
        {onlyGeneric && (
          <button type="button" onClick={p.onIdentify} disabled={p.identifying} className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-[13px] text-iris transition-colors hover:bg-iris-chip disabled:opacity-60">
            {p.identifying ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" strokeWidth={1.5} />} Identify speakers
          </button>
        )}
        {onlyGeneric && <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-4 text-fg3"><Users className="mt-px size-3 shrink-0" /> Everyone is labelled as one speaker. Fred can tell who said what by reading the conversation.</p>}
      </Section>

      <Section
        title="Topic trackers"
        action={<button type="button" aria-label="Add a topic tracker" onClick={() => setAdding((a) => !a)} className="grid size-6 place-items-center text-fg3 hover:text-foreground"><Plus className="size-4" strokeWidth={1.5} /></button>}
      >
        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); trackers.add(draft); setDraft(""); setAdding(false); }} className="mb-3 flex gap-2">
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="Word or name to track" aria-label="New topic tracker" className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:border-iris" />
            <button type="submit" disabled={!draft.trim()} className="h-8 rounded-md bg-primary px-3 text-[13px] text-white disabled:opacity-50">Add</button>
          </form>
        )}
        {tracked.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid size-10 place-items-center rounded-md border border-border bg-card text-amber-400"><Hash className="size-5" strokeWidth={1.5} /></span>
            <p className="mt-3 text-[14px] text-foreground">No topic tracker</p>
            <p className="mt-1 max-w-[240px] text-[13px] leading-5 text-fg3">Add words to count how often they come up in every meeting.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tracked.map((w) => {
              const custom = trackers.words.includes(w);
              return (
                <li key={w} className="group relative">
                  <button type="button" onClick={() => p.onTopic(w)} className={cn(card(false), "w-full")}>
                    <Hash className="size-3.5 text-fg3" strokeWidth={1.5} /> <span className="truncate">{w}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-fg3 group-hover:opacity-0">{mentionCount(p.segments, w)}</span>
                  </button>
                  {custom && <button type="button" aria-label={`Stop tracking ${w}`} onClick={() => trackers.remove(w)} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-fg3 opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"><X className="size-3.5" /></button>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
