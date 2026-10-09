"use client";

import { useState } from "react";
import { Check, ChevronRight, Copy, RotateCcw, Sparkle, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import type { ChatMessage } from "@/hooks/useChatHistory";
import { formatTimestamp } from "@/lib/time";
import type { AskSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RichAnswer } from "./RichAnswer";

type Props = {
  message: ChatMessage;
  /** The question this answer responds to (what "Save as Skill" saves) */
  question?: string;
  onCite: (meetingId: number | null, ms: number) => void;
  onSource: (s: AskSource) => void;
  onRetry: (q: string) => void;
  showMeeting: boolean;
};

const icon = "grid size-8 place-items-center rounded-md text-fg3 transition-colors hover:bg-muted hover:text-foreground";

function stepLabel(m: ChatMessage): string {
  const n = m.sources?.length ?? 0;
  if (n > 0) {
    const meetings = new Set((m.sources ?? []).map((s) => s.meeting_id)).size;
    return `Used ${n} moment${n === 1 ? "" : "s"} from ${meetings} meeting${meetings === 1 ? "" : "s"}`;
  }
  return m.mode === "search" ? "Searched your transcripts" : "Understanding your request...";
}

/** One turn of the chat: your message as a pill, Fred's as plain text with a step line and actions. */
export function Message({ message: m, question, onCite, onSource, onRetry, showMeeting }: Props) {
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const custom = useCustomSkills();

  if (m.role === "user") {
    return <li className="flex justify-end"><span className="max-w-[88%] whitespace-pre-wrap rounded-lg bg-muted px-4 py-2.5 text-[14px] leading-6 text-foreground">{m.content}</span></li>;
  }
  if (m.error) {
    return (
      <li>
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">
          {m.content}
          <button type="button" onClick={() => onRetry(m.error!.retry)} className="mt-2 flex items-center gap-1.5 text-[13px] underline underline-offset-4"><RotateCcw className="size-3.5" /> Try again</button>
        </div>
      </li>
    );
  }
  const sources = m.sources ?? [];
  return (
    <li className="space-y-3">
      <button type="button" onClick={() => sources.length > 0 && setOpen((o) => !o)} aria-expanded={open} disabled={sources.length === 0}
        className="flex items-center gap-2 text-[14px] text-fg2 disabled:cursor-default">
        <Check className="size-4 text-[#4a8a5c]" strokeWidth={1.8} /> {stepLabel(m)}
        {sources.length > 0 && <ChevronRight className={cn("size-3.5 text-fg3 transition-transform", open && "rotate-90")} strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5" aria-label="Sources">
          {sources.slice(0, 8).map((s, i) => (
            <button key={`${s.meeting_id}-${s.segment_id ?? i}-${s.start_ms}`} type="button" onClick={() => onSource(s)} className="max-w-full truncate rounded-full border border-input px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <span className="tabular-nums">{formatTimestamp(s.start_ms)}</span>{showMeeting && <> · {s.meeting_title}</>}
            </button>
          ))}
        </div>
      )}
      <div className="text-fg2"><RichAnswer text={m.content} onCite={onCite} /></div>
      <div className="flex items-center gap-1 pt-1">
        <button
          type="button" disabled={!question} onClick={() => { const s = question ? custom.save(question) : null; if (s) toast.success("Saved as a skill", { description: "Find it under AI Skills, or type / in any chat." }); }}
          className="inline-flex h-8 items-center gap-2 rounded-md pr-2 text-[14px] text-iris transition-colors hover:text-iris-soft disabled:opacity-50"
        ><Sparkle className="size-4" strokeWidth={1.5} /> Save as Skill</button>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-input" />
        <button type="button" aria-label="Copy the answer" title="Copy" className={icon} onClick={async () => { try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error("Couldn't copy."); } }}>
          {copied ? <Check className="size-4 text-emerald-400" strokeWidth={1.8} /> : <Copy className="size-4" strokeWidth={1.5} />}
        </button>
        <button type="button" aria-pressed={vote === "up"} aria-label="Good answer" title="Good answer" className={cn(icon, vote === "up" && "text-iris")} onClick={() => setVote(vote === "up" ? null : "up")}><ThumbsUp className="size-4" strokeWidth={1.5} /></button>
        <button type="button" aria-pressed={vote === "down"} aria-label="Poor answer" title="Poor answer" className={cn(icon, vote === "down" && "text-iris")} onClick={() => setVote(vote === "down" ? null : "down")}><ThumbsDown className="size-4" strokeWidth={1.5} /></button>
      </div>
    </li>
  );
}

const FOLLOW_UPS = {
  library: ["Which action items are still open?", "What were the key decisions?", "Who spoke the most?"],
  meeting: ["Summarize this meeting in three bullets", "What are the next steps?", "Were any risks raised?"],
} as const;

/** "Suggested" next questions under the latest answer. */
export function FollowUps({ scope, onPick }: { scope: "library" | "meeting"; onPick: (q: string) => void }) {
  return (
    <div className="pt-6">
      <p className="mb-3 text-[14px] text-fg3">Suggested</p>
      <ul className="space-y-2">
        {FOLLOW_UPS[scope].map((q) => (
          <li key={q}>
            <button type="button" onClick={() => onPick(q)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left text-[14px] text-fg2 transition-colors hover:text-foreground">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-iris-chip text-iris-soft"><Sparkle className="size-3.5 fill-current" strokeWidth={1.5} /></span>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
