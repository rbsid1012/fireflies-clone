"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards.
 *
 * Why this exists: Suspense boundaries hydrate *after* the rest of the page, and in that gap the
 * shared TanStack Query cache can already hold data (e.g. the library count the account menu
 * fetched). A component rendering from that cache on its first client render would not match the
 * server HTML. Gate data-driven page content on this so its first render is always the skeleton.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
