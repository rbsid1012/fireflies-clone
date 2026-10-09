"use client";

import { useMemo, useState } from "react";
import { FileText, Plus, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useMeetingMarks } from "@/hooks/useMeetingMarks";
import { useActionItemMutations, useMeetingMutations } from "@/hooks/useMeetingMutations";
import { useActiveSkills } from "@/hooks/useActiveSkills";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import { runInAskFred } from "@/lib/ask-events";
import { momentFor, parseNotes } from "@/lib/notes";
import { SKILLS, fromCustom } from "@/lib/skills";
import { formatTimestamp } from "@/lib/time";
import type { MeetingDetail, Transcript } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionItemRow } from "./ActionItemRow";
import { TEMPLATES, SummaryControls, type SummaryTemplate } from "./SummaryControls";

type Props = { meeting: MeetingDetail; transcript: Transcript; onJump: (ms: number) => void; onSkillRun?: () => void };

function Stamp({ ms, onJump }: { ms: number; onJump: (ms: number) => void }) {
  return <button type="button" onClick={() => onJump(ms)} aria-label={`Jump to ${formatTimestamp(ms)}`} className="ml-1 tabular-nums text-fg3 underline-offset-4 transition-colors hover:text-iris hover:underline">({formatTimestamp(ms)})</button>;
}

const tplKey = (id: number) => `ff_summary_template_${id}`;
function readLabel(id: number): string {
  try { return window.localStorage.getItem(tplKey(id)) || "General Summary"; } catch { return "General Summary"; }
}

/** The notes: an outline with a timestamp on every point, action items by person, then ways to carry on. */
export function NotesView({ meeting, transcript, onJump, onSkillRun }: Props) {
  const { regenerate } = useMeetingMutations(meeting.id);
  const actions = useActionItemMutations(meeting.id);
  const [marks, setMarks] = useMarksSafe(meeting.id);
  const [label, setLabel] = useState(() => readLabel(meeting.id));
  const [text, setText] = useState("");
  const [active] = useActiveSkills();
  const custom = useCustomSkills().skills;

  const chapters = meeting.chapters;
  const outline = useMemo(() => chapters.map((c, i) => ({
    chapter: c,
    points: parseNotes(c.summary).map((p) => ({ ...p, ms: p.ms ?? momentFor(p.text, c, chapters[i + 1], transcript.segments) })),
  })), [chapters, transcript.segments]);

  const groups = useMemo(() => {
    const by = new Map<string, MeetingDetail["action_items"]>();
    for (const item of meeting.action_items) {
      const who = item.assignee?.name ?? "Unassigned";
      by.set(who, [...(by.get(who) ?? []), item]);
    }
    return [...by.entries()].sort(([a], [b]) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));
  }, [meeting.action_items]);

  const choose = (name: string, opts: { template?: SummaryTemplate; instructions?: string }) => {
    regenerate.mutate(opts, { onSuccess: () => { setLabel(name); try { window.localStorage.setItem(tplKey(meeting.id), name); } catch { /* label only */ } } });
  };
  const markdown = () => [
    `# ${meeting.title}`, "",
    ...outline.flatMap(({ chapter, points }) => [`## ${chapter.title}`, ...points.flatMap((p) => [`- ${p.text} (${formatTimestamp(p.ms)})`, ...p.subs.map((d) => `  - ${d}`)]), ""]),
    "## Action items", ...meeting.action_items.map((a) => `- [${a.is_completed ? "x" : " "}] ${a.text}${a.assignee ? ` (${a.assignee.name})` : ""}`),
  ].join("\n");

  const add = (e: React.FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t) return; actions.add.mutate({ text: t, assignee_participant_id: null, due_date: null }); setText(""); };
  const skills = [...custom.map(fromCustom), ...SKILLS].filter((s) => active.includes(s.id)).concat(SKILLS).filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i).slice(0, 3);

  if (!meeting.summary && chapters.length === 0 && meeting.action_items.length === 0) {
    return <EmptyState icon={FileText} title="No meeting summary available" description="The summary hasn't been generated for this meeting." action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => regenerate.mutate({})} disabled={regenerate.isPending}>Generate summary</Button>} />;
  }

  return (
    <div className="space-y-10 text-[14px]">
      <SummaryControls
        label={label} busy={regenerate.isPending} notesMarkdown={markdown}
        onTemplate={(t) => choose(TEMPLATES.find((x) => x.id === t)?.label ?? "General Summary", { template: t })}
        onInstructions={(instructions, template) => choose(template === "custom" ? "Custom Summary" : label, { template, instructions })}
      />

      <section aria-label="Notes" className={cn(regenerate.isPending && "opacity-50 transition-opacity")}>
        <h2 className="mb-5 text-[16px] text-foreground">Notes</h2>
        {outline.length === 0 ? <p className="text-fg3">{meeting.summary?.overview}</p> : (
          <div className="space-y-5">
            {outline.map(({ chapter, points }) => (
              <div key={chapter.id}>
                <h3 className="text-[14px] text-foreground">{chapter.title}</h3>
                {points.length === 0 ? (
                  <p className="mt-1.5 text-fg2"><Stamp ms={chapter.start_ms} onJump={onJump} /></p>
                ) : (
                  <ul className="mt-2 list-disc space-y-2 pl-6 marker:text-fg3">
                    {points.map((p) => (
                      <li key={p.text} className="pl-1 leading-6 text-fg2">
                        {p.text}<Stamp ms={p.ms} onJump={onJump} />
                        {p.subs.length > 0 && (
                          <ul className="mt-1 list-[circle] space-y-1 pl-6 marker:text-fg3">
                            {p.subs.map((d) => <li key={d} className="pl-1 leading-6">{d}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Action items">
        <h2 className="mb-5 text-[16px] text-foreground">Action items</h2>
        {groups.length === 0 && <p className="mb-3 text-fg3">Nothing was picked out of this meeting. Add the follow-ups you want to track.</p>}
        <div className="space-y-5">
          {groups.map(([who, items]) => (
            <div key={who}>
              <h3 className="mb-2 text-[14px] text-foreground">{who}</h3>
              <ul className="space-y-2">
                {items.map((i) => (
                  <ActionItemRow
                    key={i.id} item={i} participants={meeting.participants} onJump={onJump}
                    onToggle={(d) => actions.toggle.mutate({ id: i.id, done: d })} onEdit={(patch) => actions.edit.mutate({ id: i.id, ...patch })} onDelete={() => actions.remove.mutate(i.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <form onSubmit={add} aria-label="Add an action item" className="mt-4 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Add an action item" aria-label="New action item" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-[14px] outline-none placeholder:text-fg3 focus-visible:border-iris" />
          <button type="submit" disabled={!text.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[14px] text-white transition-colors hover:bg-primary/90 disabled:opacity-50"><Plus className="size-4" strokeWidth={1.5} /> Add</button>
        </form>
      </section>

      <div className="mx-auto flex w-fit items-center gap-4 rounded-lg border border-border bg-card px-5 py-3.5" role="group" aria-label="Rate the summary">
        <span className="text-[14px] text-fg2">Did you like the summary?</span>
        <span className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={(marks.rating ?? 0) >= n} onClick={() => { setMarks({ rating: marks.rating === n ? null : n }); if (marks.rating !== n) toast.success("Thanks for the rating"); }} className="text-iris transition-transform hover:scale-110">
              <Star className={cn("size-5", (marks.rating ?? 0) >= n && "fill-current")} strokeWidth={1.5} />
            </button>
          ))}
        </span>
      </div>

      <section aria-label="Continue from this meeting">
        <h2 className="mb-4 flex items-center gap-2 text-[18px] text-foreground">Continue from this meeting <Sparkles className="size-5 text-amber-400" strokeWidth={1.5} /></h2>
        {meeting.summary?.overview && <p className="rounded-lg bg-muted/60 px-4 py-3.5 leading-6 text-fg2">{meeting.summary.overview}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {skills.map((s) => (
            <button key={s.id} type="button" onClick={() => { runInAskFred(meeting.id, s.prompt); onSkillRun?.(); }} className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-[14px] text-fg2 transition-colors hover:bg-muted">
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-iris-chip text-iris-soft"><Sparkles className="size-3.5 fill-current" strokeWidth={1.5} /></span>{s.title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function useMarksSafe(id: number) { return useMeetingMarks(id); }
