"use client";

import { useSyncExternalStore } from "react";

/**
 * The login token lives in localStorage so it survives refreshes and works across origins (the API
 * is on another domain in production, which rules out SameSite cookies in some browsers).
 * Trade-off: JavaScript can read it, so an XSS bug would expose it; we never inject user content as
 * HTML, which is the main defence. Falls back to memory when storage is unavailable (private mode).
 */
const KEY = "ff_token";
const listeners = new Set<() => void>();
let memoryToken: string | null = null;

function notify() {
  listeners.forEach((l) => l());
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* kept in memory for this tab only */
  }
  notify();
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // sign-in/out in another tab
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** The current token; null on the server and during hydration. */
export function useToken(): string | null {
  return useSyncExternalStore(subscribe, getToken, () => null);
}
