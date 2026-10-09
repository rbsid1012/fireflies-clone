"use client";

import { createContext, useContext, useState } from "react";
import { useChats } from "@/hooks/useChats";

type Value = ReturnType<typeof useChats> & {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  filter: string | null;
  setFilter: (q: string | null) => void;
};

const Ctx = createContext<Value | null>(null);

/** Chat list + selection, shared by the AskFred page and the chats column the shell draws beside it. */
export function AskFredProvider({ children }: { children: React.ReactNode }) {
  const chats = useChats();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  return <Ctx.Provider value={{ ...chats, activeId, setActiveId, filter, setFilter }}>{children}</Ctx.Provider>;
}

export function useAskFred(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAskFred must be used inside <AskFredProvider>");
  return v;
}
