"use client";

import Link from "next/link";
import { Layers, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAskFred } from "./AskFredContext";

const row = "flex h-[38px] w-full items-center gap-4 rounded-md px-4 text-left text-[14px] text-fg2 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring/50";

/** The column beside the AskFred page: new chat, search, connectors and the saved chats. */
export function ChatsPanel() {
  const { chats, activeId, setActiveId, remove, filter, setFilter } = useAskFred();
  const shown = filter ? chats.filter((c) => c.title.toLowerCase().includes(filter.toLowerCase())) : chats;
  return (
    <nav aria-label="Chats" className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-surface px-[26px] text-[14px] text-fg2">AskFred</div>
      <div className="space-y-0.5 p-3">
        <button type="button" onClick={() => setActiveId(null)} className={row}><Plus className="size-4" strokeWidth={1.5} /> New Chat</button>
        <button type="button" onClick={() => setFilter(filter === null ? "" : null)} aria-pressed={filter !== null} className={row}><Search className="size-4" strokeWidth={1.5} /> Search</button>
        {filter !== null && <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-iris" />}
        <Link href="/integrations" className={row}><Layers className="size-4" strokeWidth={1.5} /> Connectors</Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {shown.length === 0 ? (
          <div className="px-6 pt-24 text-center">
            <p className="text-[15px] text-foreground">{chats.length ? "No matching chats" : "No chats yet"}</p>
            {!chats.length && <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">Your chats will appear here once you start one.</p>}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((c) => (
              <li key={c.id} className="group relative">
                <button type="button" onClick={() => setActiveId(c.id)} aria-current={c.id === activeId ? "true" : undefined}
                  className={cn("block h-9 w-full truncate rounded-md px-4 pr-10 text-left text-[14px] text-fg2 transition-colors hover:bg-surface", c.id === activeId && "bg-muted")}>{c.title}</button>
                <button type="button" aria-label={`Delete chat ${c.title}`} onClick={() => { remove(c.id); if (c.id === activeId) setActiveId(null); }}
                  className="absolute right-2 top-1.5 grid size-6 place-items-center rounded-md text-fg3 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
