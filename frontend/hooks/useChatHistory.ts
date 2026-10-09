"use client";

import { useCallback, useState } from "react";
import type { AskSource } from "@/lib/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AskSource[];
  mode?: "llm" | "search";
  /** An assistant message that is really an error, with the question to retry. */
  error?: { retry: string };
};

const MAX_KEPT = 40;

function load(key: string): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** A chat thread kept in sessionStorage per scope (one meeting, or all meetings), so it survives navigation. */
export function useChatHistory(scope: string): [ChatMessage[], (update: (prev: ChatMessage[]) => ChatMessage[]) => void, () => void] {
  const key = `ff_chat:${scope}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => load(key));

  const save = (next: ChatMessage[]) => {
    try { window.sessionStorage.setItem(key, JSON.stringify(next.slice(-MAX_KEPT))); } catch { /* the thread just won't survive a reload */ }
  };
  const update = useCallback((fn: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => { const next = fn(prev).slice(-MAX_KEPT); save(next); return next; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const clear = useCallback(() => {
    setMessages([]);
    try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);
  return [messages, update, clear];
}
