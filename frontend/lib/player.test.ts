import { describe, expect, it } from "vitest";
import { PlayerController, advanceClock, findActiveIndex, type PlayerDeps } from "./player";

describe("findActiveIndex", () => {
  const starts = [1000, 4000, 9000, 15000];
  it("is -1 before the first segment starts", () => {
    expect(findActiveIndex(starts, 0)).toBe(-1);
    expect(findActiveIndex(starts, 999)).toBe(-1);
  });
  it("returns the last segment that has started", () => {
    expect(findActiveIndex(starts, 1000)).toBe(0);
    expect(findActiveIndex(starts, 3999)).toBe(0);
    expect(findActiveIndex(starts, 4000)).toBe(1);
    expect(findActiveIndex(starts, 14999)).toBe(2);
    expect(findActiveIndex(starts, 15000)).toBe(3);
    expect(findActiveIndex(starts, 999_999)).toBe(3);
  });
  it("handles empty and single-item lists", () => {
    expect(findActiveIndex([], 5)).toBe(-1);
    expect(findActiveIndex([10], 10)).toBe(0);
  });
  it("agrees with a linear scan on a big list (and is O(log n))", () => {
    const big = Array.from({ length: 20_000 }, (_, i) => i * 1500);
    for (const ms of [0, 1, 1499, 1500, 1_234_567, 29_998_500, 40_000_000]) {
      const linear = big.reduce((acc, s, i) => (s <= ms ? i : acc), -1);
      expect(findActiveIndex(big, ms)).toBe(linear);
    }
  });
});

describe("advanceClock", () => {
  it("advances by wall time times the rate", () => {
    expect(advanceClock(1000, 500, 1, 60_000)).toEqual({ ms: 1500, ended: false });
    expect(advanceClock(1000, 500, 2, 60_000)).toEqual({ ms: 2000, ended: false });
  });
  it("stops at the end", () => {
    expect(advanceClock(59_900, 500, 1, 60_000)).toEqual({ ms: 60_000, ended: true });
  });
});

/** A manual clock and frame queue so the controller can be driven deterministically. */
function harness(opts: { src?: string | null; durationMs?: number } = {}) {
  let now = 0;
  let nextId = 1;
  const frames = new Map<number, () => void>();
  const listeners: Record<string, Array<() => void>> = {};
  const audio = {
    currentTime: 0, duration: NaN, playbackRate: 1, src: "", preload: "",
    paused: true,
    play() { this.paused = false; (listeners.play ?? []).forEach((f) => f()); return Promise.resolve(); },
    pause() { this.paused = true; (listeners.pause ?? []).forEach((f) => f()); },
    addEventListener(type: string, fn: () => void) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type: string, fn: () => void) { listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn); },
  };
  const deps: PlayerDeps = {
    now: () => now,
    raf: (cb) => { const id = nextId++; frames.set(id, cb); return id; },
    caf: (id) => { frames.delete(id); },
    createAudio: () => audio as never,
  };
  const player = new PlayerController({ src: opts.src ?? null, durationMs: opts.durationMs ?? 60_000 }, deps);
  const advance = (ms: number) => {
    now += ms;
    const pending = [...frames.entries()];
    frames.clear();
    pending.forEach(([, cb]) => cb());
  };
  const emit = (type: string) => (listeners[type] ?? []).forEach((f) => f());
  return { player, advance, audio, emit, frames };
}

describe("PlayerController (simulated clock)", () => {
  it("starts paused at zero and plays in real time", () => {
    const { player, advance } = harness();
    expect(player.getState()).toMatchObject({ mode: "simulated", playing: false, rate: 1, durationMs: 60_000 });
    player.play();
    advance(1000); advance(500);
    expect(player.getMs()).toBe(1500);
    expect(player.getState().playing).toBe(true);
  });

  it("pauses and resumes without drift", () => {
    const { player, advance } = harness();
    player.play(); advance(2000);
    player.pause(); advance(5000);
    expect(player.getMs()).toBe(2000);
    expect(player.getState().playing).toBe(false);
    player.play(); advance(1000);
    expect(player.getMs()).toBe(3000);
  });

  it("seeks, clamping to the meeting", () => {
    const { player } = harness();
    player.seek(12_345); expect(player.getMs()).toBe(12_345);
    player.seek(-50); expect(player.getMs()).toBe(0);
    player.seek(999_999); expect(player.getMs()).toBe(60_000);
  });

  it("keeps playing from the new position after a seek", () => {
    const { player, advance } = harness();
    player.play(); advance(1000);
    player.seek(30_000); advance(1000);
    expect(player.getMs()).toBe(31_000);
  });

  it("honours the playback rate", () => {
    const { player, advance } = harness();
    player.setRate(2); player.play(); advance(1000);
    expect(player.getMs()).toBe(2000);
  });

  it("stops at the end and replays from the start", () => {
    const { player, advance } = harness({ durationMs: 3000 });
    player.play(); advance(1000); advance(1000); advance(1500);
    expect(player.getMs()).toBe(3000);
    expect(player.getState().playing).toBe(false);
    player.play(); advance(1000);
    expect(player.getMs()).toBe(1000); // restarted
  });

  it("skips by a delta", () => {
    const { player } = harness();
    player.seek(20_000); player.skip(-10_000); expect(player.getMs()).toBe(10_000);
    player.skip(+10_000); expect(player.getMs()).toBe(20_000);
  });

  it("notifies subscribers and stops them after destroy", () => {
    const { player, advance } = harness();
    let msCalls = 0, stateCalls = 0;
    player.subscribeMs(() => msCalls++); player.subscribeState(() => stateCalls++);
    player.play(); advance(100);
    expect(msCalls).toBeGreaterThan(0); expect(stateCalls).toBe(1);
    const before = msCalls;
    player.destroy(); player.seek(5000);
    expect(msCalls).toBe(before);
  });

  it("returns a new state object only when state changes", () => {
    const { player, advance } = harness();
    const first = player.getState();
    player.play(); advance(100); advance(100);
    const playing = player.getState();
    expect(playing).not.toBe(first);
    advance(100);
    expect(player.getState()).toBe(playing); // time ticks don't churn the state object
  });

  it("follows a changed duration while simulated", () => {
    const { player } = harness({ durationMs: 1000 });
    player.setDuration(90_000);
    expect(player.getState().durationMs).toBe(90_000);
  });

  it("does not leave a frame loop running after destroy", () => {
    const { player, frames } = harness();
    player.play(); player.destroy();
    expect(frames.size).toBe(0);
  });
});

describe("PlayerController (audio)", () => {
  it("mirrors the element's clock and uses its real duration", () => {
    const { player, audio, emit } = harness({ src: "https://x/a.mp3" });
    expect(player.getState().mode).toBe("audio");
    audio.duration = 91.5; emit("loadedmetadata");
    expect(player.getState().durationMs).toBe(91_500);
    audio.currentTime = 12.34; emit("timeupdate");
    expect(player.getMs()).toBe(12_340);
  });

  it("seeks by setting currentTime and reflects it immediately", () => {
    const { player, audio, emit } = harness({ src: "x" });
    audio.duration = 100; emit("loadedmetadata");
    player.seek(45_000);
    expect(audio.currentTime).toBe(45);
    expect(player.getMs()).toBe(45_000);
  });

  it("plays and pauses the element and reports state from its events", () => {
    const { player, audio, advance } = harness({ src: "x" });
    player.play();
    expect(audio.paused).toBe(false); expect(player.getState().playing).toBe(true);
    audio.currentTime = 3; advance(16); // the frame loop reads the element between timeupdate events
    expect(player.getMs()).toBe(3000);
    player.pause();
    expect(audio.paused).toBe(true); expect(player.getState().playing).toBe(false);
  });

  it("applies the chosen rate to the element", () => {
    const { player, audio } = harness({ src: "x" });
    player.setRate(1.5); player.play();
    expect(audio.playbackRate).toBe(1.5);
  });

  it("falls back to the simulated clock if the file can't be loaded", () => {
    const { player, emit, advance } = harness({ src: "x", durationMs: 20_000 });
    emit("error");
    expect(player.getState()).toMatchObject({ mode: "simulated", durationMs: 20_000 });
    expect(player.getState().error).toMatch(/simulated/);
    player.play(); advance(1000);
    expect(player.getMs()).toBe(1000);
  });

  it("stays paused if the browser refuses to autoplay", async () => {
    const { player, audio } = harness({ src: "x" });
    audio.play = () => Promise.reject(new Error("NotAllowedError"));
    player.play();
    await Promise.resolve(); await Promise.resolve();
    expect(player.getState().playing).toBe(false);
  });
});
