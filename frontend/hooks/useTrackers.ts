"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "ff_trackers";
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
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
function write(next: string[]) { try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not persisted */ } listeners.forEach((l) => l()); }

/** Words you want counted in every meeting ("pricing", "competitor"). Kept in this browser. */
export function useTrackers() {
  const words = useSyncExternalStore(subscribe, read, () => EMPTY);
  const add = useCallback((word: string) => {
    const w = word.trim().toLowerCase().slice(0, 40);
    if (w && !read().includes(w)) write([...read(), w].slice(0, 20));
  }, []);
  const remove = useCallback((word: string) => write(read().filter((x) => x !== word)), []);
  return { words, add, remove };
}
