"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CustomSkill = { id: string; title: string; prompt: string };

const KEY = "ff_custom_skills";
const listeners = new Set<() => void>();
const EMPTY: CustomSkill[] = [];
let cache: { raw: string | null; value: CustomSkill[] } = { raw: null, value: EMPTY };

function read(): CustomSkill[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.value;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const value = Array.isArray(parsed) ? parsed.filter((s): s is CustomSkill => !!s && typeof (s as CustomSkill).id === "string" && typeof (s as CustomSkill).prompt === "string") : EMPTY;
    cache = { raw, value };
    return value;
  } catch {
    return EMPTY;
  }
}

function write(next: CustomSkill[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the skill just won't persist */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** Prompts you saved from a chat ("Save as Skill"). They behave like built-in AI Skills and live in this browser. */
export function useCustomSkills() {
  const skills = useSyncExternalStore(subscribe, read, () => EMPTY);
  const save = useCallback((prompt: string): CustomSkill | null => {
    const text = prompt.trim();
    if (!text) return null;
    const existing = read().find((s) => s.prompt === text);
    if (existing) return existing;
    const skill = { id: `custom-${Date.now().toString(36)}`, title: text.length > 38 ? `${text.slice(0, 36)}…` : text, prompt: text };
    write([skill, ...read()].slice(0, 30));
    return skill;
  }, []);
  const remove = useCallback((id: string) => write(read().filter((s) => s.id !== id)), []);
  return { skills, save, remove };
}
