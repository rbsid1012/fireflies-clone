"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Marks = { starred: boolean; reviewed: boolean; vote: "up" | "down" | null; rating: number | null };
const NONE: Marks = { starred: false, reviewed: false, vote: null, rating: null };
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: Marks }>();

const key = (id: number) => `ff_marks_${id}`;

function read(id: number): Marks {
  try {
    const raw = window.localStorage.getItem(key(id));
    const hit = cache.get(key(id));
    if (hit && hit.raw === raw) return hit.value;
    const value = raw ? { ...NONE, ...(JSON.parse(raw) as Partial<Marks>) } : NONE;
    cache.set(key(id), { raw, value });
    return value;
  } catch {
    return NONE;
  }
}

/** Personal markers on a meeting (favourite, reviewed, thumbs). Stored in this browser only. */
export function useMeetingMarks(id: number): [Marks, (patch: Partial<Marks>) => void] {
  const marks = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    () => read(id), () => NONE,
  );
  const set = useCallback((patch: Partial<Marks>) => {
    try { window.localStorage.setItem(key(id), JSON.stringify({ ...read(id), ...patch })); } catch { /* the marker just won't persist */ }
    listeners.forEach((l) => l());
  }, [id]);
  return [marks, set];
}
