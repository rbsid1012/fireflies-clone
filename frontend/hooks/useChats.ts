"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "./useChatHistory";

export type Chat = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

const KEY = "ff_askfred_chats";
const MAX_CHATS = 30;
const MAX_MESSAGES = 40;

function load(): Chat[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Chat[]) : [];
  } catch {
    return [];
  }
}

/** The AskFred page's chat list, kept in this browser (not on the server). Only call from client-only trees. */
export function useChats() {
  const [chats, setChats] = useState<Chat[]>(load);

  const commit = useCallback((fn: (prev: Chat[]) => Chat[]) => {
    setChats((prev) => {
      const next = fn(prev).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the list just won't survive a reload */ }
      return next;
    });
  }, []);

  const create = useCallback((id: string, title: string) => {
    commit((prev) => [{ id, title: title.slice(0, 60), updatedAt: Date.now(), messages: [] }, ...prev]);
  }, [commit]);

  const setMessages = useCallback((id: string, fn: (prev: ChatMessage[]) => ChatMessage[]) => {
    commit((prev) => prev.map((c) => (c.id === id ? { ...c, updatedAt: Date.now(), messages: fn(c.messages).slice(-MAX_MESSAGES) } : c)));
  }, [commit]);

  const remove = useCallback((id: string) => commit((prev) => prev.filter((c) => c.id !== id)), [commit]);

  return { chats, create, setMessages, remove };
}
