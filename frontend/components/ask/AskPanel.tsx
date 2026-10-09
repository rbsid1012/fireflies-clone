"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUp, Hash, Layers, Loader2, Mic, MessageSquare, Plus, Sparkles, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { FredIcon } from "@/components/layout/icons";
import { usePlayer } from "@/components/player/PlayerProvider";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";
import { api, ApiError } from "@/lib/api";
import { SKILLS, skillMatches } from "@/lib/skills";
import type { AskResult, AskSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChatHistory } from "@/hooks/useChatHistory";
import { FollowUps, Message } from "./ChatMessage";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import { fromCustom } from "@/lib/skills";

const SUGGESTIONS = {
  library: [["✅", "My action items"], ["🎯", "Key decisions"], ["📌", "Key initiatives"]],
  home: [["✨", "What's my day looking like?"], ["❓", "Pending tasks across all meetings"], ["✅", "List out my action items from the past week"]],
} as const;
const MEETING_PROMPTS = ["Were any challenges or issues raised?", "Identify the key decisions made.", "What were the main topics?"];

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

type Props = {
  meetingId: number | null;
  className?: string;
  /** Chip above the input naming what Fred is looking at, e.g. "My Meetings" */
  scopeLabel?: string;
  /** Second greeting line */
  subtitle?: string;
  /** Which set of starter prompts and placeholder to show */
  variant?: "home" | "library" | "meeting";
};

type Recognition = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; lang: string; interimResults: boolean };
function speechRecognition(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Fred: ask about this meeting (meetingId) or about everything (null). Works with or without an AI model on the server. */
export function AskPanel({ meetingId, className, scopeLabel, subtitle, variant }: Props) {
  const kind = variant ?? (meetingId === null ? "library" : "meeting");
  const { user } = useAuth();
  const router = useRouter();
  const player = usePlayer();
  const [messages, update, clear] = useChatHistory(meetingId === null ? "all" : String(meetingId));
  const [draft, setDraft] = useState("");
  const [promoGone, setPromoGone] = usePersistentFlag("ask-promo-dismissed");
  const [listening, setListening] = useState(false);
  const suggestions = useQuery({
    queryKey: ["suggestions", meetingId], enabled: meetingId !== null, staleTime: 5 * 60_000,
    queryFn: () => api.get<{ questions: string[] }>(`/api/meetings/${meetingId}/suggestions`),
  });
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<Recognition | null>(null);

  const ask = useMutation({
    mutationFn: (question: string) => {
      const history = messages.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.content }));
      return api.post<AskResult>(meetingId === null ? "/api/ask" : `/api/meetings/${meetingId}/ask`, { question, history });
    },
    onSuccess: (res) => update((prev) => [...prev, { id: newId(), role: "assistant", content: res.answer, sources: res.sources, mode: res.mode }]),
    onError: (e, question) => update((prev) => [...prev, {
      id: newId(), role: "assistant", content: e instanceof ApiError ? e.message : "Something went wrong.", error: { retry: question },
    }]),
  });

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages.length, ask.isPending]);

  const send = (question: string) => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    update((prev) => [...prev, { id: newId(), role: "user", content: q }]);
    setDraft("");
    ask.mutate(q);
  };

  const jump = (targetMeeting: number | null, ms: number) => {
    if ((targetMeeting === null || targetMeeting === meetingId) && meetingId !== null && player) {
      player.seek(ms);
      player.play();
    } else if (targetMeeting !== null || meetingId === null) {
      router.push(`/meetings/${targetMeeting}?t=${ms}`);
    }
  };
  const onSource = (s: AskSource) => jump(s.meeting_id, s.start_ms);

  // Other parts of the page (a meeting's AI Skills tab) can ask this panel to run a prompt
  const runExternal = useEffectEvent((prompt: string) => send(prompt));
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ meetingId: number | null; prompt: string }>).detail;
      if (d.meetingId === meetingId) runExternal(d.prompt);
    };
    window.addEventListener("ask-fred:run", handler);
    return () => window.removeEventListener("ask-fred:run", handler);
  }, [meetingId]);
  const firstName = user?.name.split(" ")[0];

  const toggleDictation = () => {
    if (listening) { recognition.current?.stop(); return; }
    const Ctor = speechRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.onresult = (e) => { const text = Array.from(e.results).map((x) => x[0].transcript).join(" "); setDraft((d) => (d ? `${d} ${text}` : text)); };
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };
  const canDictate = typeof window !== "undefined" && speechRecognition() !== null;

  const customSkills = useCustomSkills().skills;
  const slash = draft.startsWith("/") ? skillMatches(draft.slice(1), customSkills.map(fromCustom)) : null;
  const scope = scopeLabel ?? (meetingId === null ? "My Meetings" : "This meeting");
  const subtitleText = subtitle ?? (kind === "meeting" ? "Ask anything about this meeting" : "Get ready for your meeting");

  return (
    <aside aria-label="Ask Fred" className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="flex items-center gap-2 text-[14px] text-fg2"><FredIcon className="size-[18px]" /> Ask Fred</span>
        <span className="flex items-center gap-1">
          <Link href="/askfred" aria-label="Open the full AskFred page" title="Open AskFred" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><MessageSquare className="size-4" strokeWidth={1.6} /></Link>
          <button type="button" onClick={clear} aria-label="Start a new chat" title="New chat" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="size-4" strokeWidth={1.6} /></button>
        </span>
      </header>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-3" aria-live="polite">
        {!promoGone && (
          <div className="relative mb-2 shrink-0 rounded-xl bg-iris-chip p-4">
            <button type="button" aria-label="Dismiss" onClick={() => setPromoGone(true)} className="absolute right-3 top-3 grid size-6 place-items-center rounded-md text-fg3 hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
            <div className="flex gap-3 pr-6">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[14px] font-semibold text-[#4a154b]">#</span>
              <p className="text-[14px] leading-6 text-foreground">Send recaps to Slack, with a webhook. <span className="text-muted-foreground">Every new meeting is posted for you.</span></p>
            </div>
            <Link href="/integrations" className="mt-2 block text-right text-[14px] text-iris hover:underline">Connect</Link>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex min-h-[250px] flex-1 flex-col justify-end pb-6">
            <Sparkles className="size-7 text-[#2dbf9b]" strokeWidth={1.5} />
            <p className="mt-5 text-[20px] font-normal leading-[28px] text-foreground">Hi {firstName?.toUpperCase() ?? "there"}!</p>
            <p className="text-[20px] font-normal leading-[28px] text-foreground">{subtitleText}</p>
            <div className="mt-6 flex flex-col items-start gap-3">
              {kind === "meeting"
                ? (suggestions.data?.questions.length ? suggestions.data.questions : MEETING_PROMPTS).map((p) => (
                    <button key={p} type="button" onClick={() => send(p)} className="h-10 rounded-lg bg-chip px-4 text-left text-[14px] text-fg2 transition-colors hover:bg-chip-hover">{p}</button>
                  ))
                : SUGGESTIONS[kind].map(([emoji, label]) => (
                    <button key={label} type="button" onClick={() => send(label)} className="inline-flex h-10 items-center gap-3 rounded-lg bg-chip px-4 text-[14px] text-fg2 transition-colors hover:bg-chip-hover">
                      <span aria-hidden="true" className="text-[16px] leading-none">{emoji}</span> {label}
                    </button>
                  ))}
              {kind === "meeting" && (
                <div className="flex flex-wrap gap-3">
                  {SKILLS.slice(0, 2).map((s2) => (
                    <button key={s2.id} type="button" onClick={() => send(s2.prompt)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-chip px-3.5 text-[14px] text-fg2 transition-colors hover:bg-chip-hover">
                      <Sparkles className="size-4 text-amber-400" strokeWidth={1.7} /> {s2.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
          <ul className="space-y-5">
            {messages.map((m, i) => <Message key={m.id} message={m} question={messages.slice(0, i).reverse().find((x) => x.role === "user")?.content} onCite={jump} onSource={onSource} onRetry={(q) => send(q)} showMeeting={meetingId === null} />)}
            {ask.isPending && (
              <li className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Understanding your request...</li>
            )}
          </ul>
          {!ask.isPending && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1].error && (
            <FollowUps scope={meetingId === null ? "library" : "meeting"} onPick={send} />
          )}
          </>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="relative shrink-0 px-5 pb-[17px] pt-3">
        {slash && (
          <ul role="listbox" aria-label="AI Skills" className="absolute inset-x-5 bottom-full mb-1 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
            {slash.length === 0 && <li className="px-3 py-2 text-[13px] text-muted-foreground">No matching skill</li>}
            {slash.map((s2) => (
              <li key={s2.id}>
                <button type="button" role="option" aria-selected={false} onClick={() => send(s2.prompt)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-accent">
                  <s2.icon className="size-4 shrink-0 text-iris" strokeWidth={1.5} /> {s2.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-xl border border-border bg-card p-3 focus-within:border-iris">
          {kind !== "home" && <span className="mb-1.5 inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-[14px] text-fg2"><Hash className="size-3.5 text-muted-foreground" strokeWidth={1.5} /> {scope}</span>}
          <textarea
            ref={area} value={draft} rows={2} maxLength={2000} aria-label="Ask Fred a question" placeholder={kind === "home" ? "Type @ to mention" : "Ask anything. Type / to run AI skills."}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !draft.startsWith("/")) { e.preventDefault(); send(draft); } }}
            className="block max-h-[140px] min-h-[52px] w-full resize-none bg-transparent px-0.5 py-1 text-[14px] outline-none placeholder:text-fg4"
          />
          <div className="mt-1 flex items-center gap-1">
            <Link href="/upload" aria-label="Add a meeting" title="Add a meeting" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="size-5" strokeWidth={1.5} /></Link>
            <Link href="/integrations" aria-label="Integrations" title="Integrations" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Layers className="size-5" strokeWidth={1.5} /></Link>
            <span className="flex-1" />
            {canDictate && (
              <button type="button" onClick={toggleDictation} aria-pressed={listening} aria-label={listening ? "Stop dictation" : "Dictate your question"} className={cn("grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground", listening && "bg-destructive/20 text-destructive")}><Mic className="size-5" strokeWidth={1.5} /></button>
            )}
            <button type="submit" disabled={!draft.trim() || ask.isPending || draft.startsWith("/")} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50">
              <ArrowUp className="size-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
