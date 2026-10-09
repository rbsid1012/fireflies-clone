"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { PlayerController, findActiveIndex, type PlayerState } from "@/lib/player";

const PlayerContext = createContext<PlayerController | null>(null);

const idle: PlayerState = { mode: "simulated", playing: false, rate: 1, durationMs: 0, error: null };
const never = () => () => {};

/** Owns one PlayerController per meeting (re-created if the recording changes) and cleans it up. */
export function PlayerProvider({ src, durationMs, children }: { src: string | null; durationMs: number; children: React.ReactNode }) {
  const [controller, setController] = useState<PlayerController | null>(null);

  useEffect(() => {
    // Creating the controller needs the browser (Audio, requestAnimationFrame), so it can only happen
    // after mount, and the tree needs to re-render once to receive it. That one extra render is intended.
    const created = new PlayerController({ src, durationMs });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setController(created);
    return () => created.destroy();
    // Only the media source rebuilds the player; a changed duration is applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => controller?.setDuration(durationMs), [controller, durationMs]);

  return <PlayerContext.Provider value={controller}>{children}</PlayerContext.Provider>;
}

/** The controller, or null before the first client render and on pages without a player. */
export const usePlayer = () => useContext(PlayerContext);

export function usePlayerState(): PlayerState {
  const player = usePlayer();
  return useSyncExternalStore(player?.subscribeState ?? never, () => player?.getState() ?? idle, () => idle);
}

/** Current position in ms. Re-renders every frame while playing, so use it only in small components. */
export function useCurrentMs(): number {
  const player = usePlayer();
  return useSyncExternalStore(player?.subscribeMs ?? never, () => player?.getMs() ?? 0, () => 0);
}

/** Index of the segment being spoken. Re-renders only when it *changes*, not on every frame. */
export function useActiveIndex(starts: readonly number[]): number {
  const player = usePlayer();
  return useSyncExternalStore(player?.subscribeMs ?? never, () => findActiveIndex(starts, player?.getMs() ?? 0), () => -1);
}
