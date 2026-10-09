"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "ff_active_skills";
const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.value;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const value = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
    cache = { raw, value };
    return value;
  } catch {
    return EMPTY;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** The AI Skills you have turned on. They show up on each meeting's AI Skills tab for one-click runs. Kept in this browser. */
export function useActiveSkills(): [string[], (id: string, on: boolean) => void] {
  const active = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((id: string, on: boolean) => {
    const next = on ? [...new Set([...read(), id])] : read().filter((x) => x !== id);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the choice just won't persist */ }
    listeners.forEach((l) => l());
  }, []);
  return [active, toggle];
}
