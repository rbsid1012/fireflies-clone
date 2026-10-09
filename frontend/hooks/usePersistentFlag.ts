"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // other tabs
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * A boolean kept in localStorage, for per-viewer UI conveniences (e.g. sidebar collapsed).
 * Storage can throw or be unavailable (private mode), so every access is guarded and the
 * flag simply falls back to `false`. The server snapshot is `false`, so SSR and the first
 * client render agree and there is no hydration mismatch.
 */
export function usePersistentFlag(key: string): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore: the flag just won't persist */
      }
      listeners.forEach((l) => l()); // storage events don't fire in the tab that wrote
    },
    [key],
  );
  return [value, set];
}
