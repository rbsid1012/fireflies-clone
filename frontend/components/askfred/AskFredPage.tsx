"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp, CalendarCheck, CheckCheck, ChevronDown, HelpCircle, Layers, ListTodo, Loader2, Mic, Plus, Sparkles, Wand2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { FollowUps, Message } from "@/components/ask/ChatMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { useAskFred } from "./AskFredContext";
import { useAuthConfig } from "@/hooks/useAuthConfig";
import { useHydrated } from "@/hooks/useHydrated";
import { api, ApiError } from "@/lib/api";
import type { AskResult, AskSource } from "@/lib/types";

const SUGGESTIONS = [
  { icon: CheckCheck, text: "List my action items & todos for this week" },
  { icon: ListTodo, text: "Summarize my last meeting" },
  { icon: Wand2, text: "What decisions were made recently?" },
  { icon: HelpCircle, text: "Which questions are still unanswered?" },
  { icon: CalendarCheck, text: "Prepare weekly digest, based on my meetings" },
];

let counter = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

function Inner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { chats, create, setMessages, activeId, setActiveId } = useAskFred();
  const config = useAuthConfig();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const first = user?.name.split(" ")[0]?.toUpperCase() ?? "";

  const ask = useMutation({
    mutationFn: ({ chatId, question, history }: { chatId: string; question: string; history: { role: string; content: string }[] }) =>
      api.post<AskResult>("/api/ask", { question, history }).then((res) => ({ chatId, res })),
    onSuccess: ({ chatId, res }) => setMessages(chatId, (prev) => [...prev, { id: newId("m"), role: "assistant", content: res.answer, sources: res.sources, mode: res.mode }]),
    onError: (e, v) => setMessages(v.chatId, (prev) => [...prev, { id: newId("m"), role: "assistant", content: e instanceof ApiError ? e.message : "Something went wrong.", error: { retry: v.question } }]),
  });

  const send = (question: string, chatOverride?: string) => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    let id = chatOverride ?? activeId;
    const existing = chats.find((c) => c.id === id);
    if (!id || !existing) {
      id = newId("c");
      create(id, q);
      setActiveId(id);
    }
    const history = (existing?.messages ?? []).filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMessages(id, (prev) => [...prev, { id: newId("m"), role: "user", content: q }]);
    setDraft("");
    ask.mutate({ chatId: id, question: q, history });
  };

  // /askfred?q=... (used by AI Skills) starts a new chat with that prompt, once
  const initialQ = params.get("q");
  useEffect(() => {
    if (initialQ && !autoSent.current) {
      autoSent.current = true;
      router.replace("/askfred");
      send(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages.length, ask.isPending]);

  const jump = (meetingId: number | null, ms: number) => { if (meetingId !== null) router.push(`/meetings/${meetingId}?t=${ms}`); };

  const composer = (
    <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="w-full">
      <div className="h-[109px] rounded-xl border border-iris bg-card px-4 pb-3 pt-3.5 focus-within:border-iris">
        <textarea
          value={draft} rows={2} maxLength={2000} aria-label="Ask Fred a question" placeholder="Ask anything, @ for context and / for skills"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          className="block h-8 w-full resize-none bg-transparent text-[14px] text-foreground outline-none placeholder:text-fg4"
        />
        <div className="mt-[14px] flex items-center gap-1">
          <Link href="/upload" aria-label="Add a meeting" title="Add a meeting" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="size-5" strokeWidth={1.5} /></Link>
          <Link href="/integrations" aria-label="Connectors" title="Connectors" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Layers className="size-5" strokeWidth={1.5} /></Link>
          <span className="flex-1" />
          <span className="mr-2 inline-flex items-center gap-1 text-[14px] text-fg2" title={config.data?.ai_model ? "The model that writes answers" : "No AI model is configured, so answers quote your transcripts"}>
            {config.data?.ai_model ? config.data.ai_model.split("/").pop() : "Search mode"} <ChevronDown className="size-4" strokeWidth={1.5} />
          </span>
          <span className="grid size-8 place-items-center text-muted-foreground" aria-hidden="true"><Mic className="size-5" strokeWidth={1.5} /></span>
          <button type="submit" disabled={!draft.trim() || ask.isPending} aria-label="Send" className="grid size-9 place-items-center rounded-lg bg-[#4b3bd9] text-white transition-colors hover:bg-primary disabled:opacity-60">
            {ask.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={1.8} />}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-6 pt-[97px]">
            <div className="w-full max-w-[614px]">
              <h1 className="text-[20px] font-normal leading-7 text-foreground">Hi {first || "there"}, how can I help today?</h1>
              <div className="mt-[42px]">{composer}</div>
              <Link href="/integrations" className="mx-auto mt-2 flex h-9 w-fit items-center gap-3 rounded-lg bg-card px-3.5 text-[14px] text-fg2 transition-colors hover:bg-surface">
                <span aria-hidden="true" className="grid size-5 place-items-center rounded bg-white text-[12px] font-semibold text-[#4a154b]">#</span>
                Send recaps to Slack with a webhook <span className="ml-6 inline-flex items-center gap-1 text-iris"><Plus className="size-4" strokeWidth={1.5} /> Add</span>
              </Link>
              <ul className="mt-[35px] space-y-[7.5px]">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <button type="button" onClick={() => send(text)} className="flex h-[38px] w-full items-center gap-3.5 rounded-lg bg-card/70 px-3.5 text-left text-[14px] text-fg2 transition-colors hover:bg-surface"><Icon className="size-4 text-muted-foreground" strokeWidth={1.5} /> {text}</button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-auto pt-10 text-center text-[13px] text-fg3">Answers come from your transcripts, with timestamps you can click.</p>
          </div>
        ) : (
          <>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 py-6" aria-live="polite">
              <ul className="mx-auto max-w-[614px] space-y-6">
                {messages.map((m, i) => <Message key={m.id} message={m} question={messages.slice(0, i).reverse().find((x) => x.role === "user")?.content} onCite={jump} onSource={(s: AskSource) => jump(s.meeting_id, s.start_ms)} onRetry={(q) => send(q)} showMeeting />)}
                {ask.isPending && <li className="flex items-center gap-2 text-[14px] text-muted-foreground"><Sparkles className="size-4 animate-pulse" /> Understanding your request...</li>}
              </ul>
              {!ask.isPending && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1].error && <FollowUps scope="library" onPick={(q) => send(q)} />}
            </div>
            <div className="shrink-0 px-6 pb-5"><div className="mx-auto max-w-[614px]">{composer}</div></div>
          </>
        )}
      </section>
    </div>
  );
}

export function AskFredPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="p-8"><Skeleton className="h-64 w-full max-w-3xl" /></div>;
  return <Suspense><Inner /></Suspense>;
}
