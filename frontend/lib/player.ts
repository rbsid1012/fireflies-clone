/**
 * The player: the single source of truth for "where are we in the meeting" (`currentMs`).
 *
 * It is plain TypeScript with no React so the sync logic is easy to test. Two modes share one
 * interface: a real <audio>/<video> element when the meeting has media, or a simulated clock that
 * ticks over `durationMs` when it doesn't, so the transcript can still be followed and scrubbed.
 */

/** Index of the last segment that has started at `ms` (binary search; `starts` must be sorted). -1 before the first. */
export function findActiveIndex(starts: readonly number[], ms: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Move the simulated clock forward by `dtMs` of wall time at `rate`, stopping at the end. */
export function advanceClock(ms: number, dtMs: number, rate: number, durationMs: number): { ms: number; ended: boolean } {
  const next = ms + dtMs * rate;
  return next >= durationMs ? { ms: durationMs, ended: true } : { ms: next, ended: false };
}

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export type PlayerMode = "audio" | "simulated";

export type PlayerState = {
  mode: PlayerMode;
  playing: boolean;
  rate: number;
  durationMs: number;
  /** Set when the media file couldn't be loaded and we fell back to the simulated clock. */
  error: string | null;
};

type AudioLike = Pick<HTMLAudioElement, "currentTime" | "duration" | "playbackRate" | "play" | "pause" | "addEventListener" | "removeEventListener"> & { src: string; preload: string };

export type PlayerDeps = {
  now: () => number;
  raf: (cb: () => void) => number;
  caf: (id: number) => void;
  createAudio: (src: string) => AudioLike;
};

const browserDeps = (): PlayerDeps => ({
  now: () => performance.now(),
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  createAudio: (src) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = src;
    return audio;
  },
});

export class PlayerController {
  private ms = 0;
  private state: PlayerState;
  private msListeners = new Set<() => void>();
  private stateListeners = new Set<() => void>();
  private audio: AudioLike | null = null;
  private frame: number | null = null;
  private lastTick = 0;
  private cleanup: Array<() => void> = [];
  private destroyed = false;

  constructor(opts: { src: string | null; durationMs: number }, private deps: PlayerDeps = browserDeps()) {
    this.state = { mode: "simulated", playing: false, rate: 1, durationMs: Math.max(0, opts.durationMs), error: null };
    if (opts.src) this.attachAudio(opts.src);
  }

  // ---- subscriptions (for useSyncExternalStore) -------------------------------------------
  subscribeMs = (cb: () => void) => { this.msListeners.add(cb); return () => this.msListeners.delete(cb); };
  subscribeState = (cb: () => void) => { this.stateListeners.add(cb); return () => this.stateListeners.delete(cb); };
  getMs = () => this.ms;
  getState = () => this.state;

  private setState(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.stateListeners.forEach((l) => l());
  }

  private setMs(ms: number) {
    if (ms === this.ms) return;
    this.ms = ms;
    this.msListeners.forEach((l) => l());
  }

  // ---- audio mode --------------------------------------------------------------------------
  private attachAudio(src: string) {
    const audio = this.deps.createAudio(src);
    this.audio = audio;
    const on = (type: string, fn: () => void) => {
      audio.addEventListener(type, fn);
      this.cleanup.push(() => audio.removeEventListener(type, fn));
    };
    this.state = { ...this.state, mode: "audio" };
    on("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) this.setState({ durationMs: Math.round(audio.duration * 1000) });
    });
    on("timeupdate", () => this.setMs(Math.round(audio.currentTime * 1000)));
    on("play", () => { this.setState({ playing: true }); this.startLoop(); });
    on("pause", () => { this.setState({ playing: false }); this.stopLoop(); });
    on("ended", () => { this.setMs(this.state.durationMs); this.setState({ playing: false }); this.stopLoop(); });
    on("error", () => this.fallBackToSimulated("Couldn't load the recording, so playback is simulated."));
  }

  private fallBackToSimulated(error: string) {
    const wasPlaying = this.state.playing;
    this.detachAudio();
    this.setState({ mode: "simulated", playing: false, error });
    if (wasPlaying) this.play();
  }

  private detachAudio() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.audio?.pause();
    this.audio = null;
    this.stopLoop();
  }

  // ---- the frame loop: smooth time while playing --------------------------------------------
  private startLoop() {
    if (this.frame !== null || this.destroyed) return;
    this.lastTick = this.deps.now();
    const tick = () => {
      this.frame = null;
      if (!this.state.playing || this.destroyed) return;
      const now = this.deps.now();
      if (this.audio) {
        this.setMs(Math.round(this.audio.currentTime * 1000));
      } else {
        const { ms, ended } = advanceClock(this.ms, now - this.lastTick, this.state.rate, this.state.durationMs);
        this.setMs(ms);
        if (ended) {
          this.setState({ playing: false });
          return;
        }
      }
      this.lastTick = now;
      this.frame = this.deps.raf(tick);
    };
    this.frame = this.deps.raf(tick);
  }

  private stopLoop() {
    if (this.frame !== null) this.deps.caf(this.frame);
    this.frame = null;
  }

  // ---- controls ------------------------------------------------------------------------------
  play() {
    if (this.destroyed) return;
    if (this.ms >= this.state.durationMs && this.state.durationMs > 0) this.seek(0); // replay from the start
    if (this.audio) {
      this.audio.playbackRate = this.state.rate;
      // Browsers can refuse to autoplay; stay paused rather than showing a false "playing" state
      void Promise.resolve(this.audio.play()).catch(() => this.setState({ playing: false }));
    } else {
      this.setState({ playing: true });
      this.startLoop();
    }
  }

  pause() {
    if (this.audio) this.audio.pause();
    else {
      this.setState({ playing: false });
      this.stopLoop();
    }
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  seek(ms: number) {
    const clamped = Math.min(Math.max(0, Math.round(ms)), this.state.durationMs || Number.MAX_SAFE_INTEGER);
    if (this.audio) this.audio.currentTime = clamped / 1000;
    this.setMs(clamped);
    this.lastTick = this.deps.now();
  }

  skip(deltaMs: number) {
    this.seek(this.ms + deltaMs);
  }

  setRate(rate: number) {
    if (this.audio) this.audio.playbackRate = rate;
    this.setState({ rate });
  }

  setDuration(durationMs: number) {
    if (this.state.mode === "simulated" && durationMs !== this.state.durationMs) this.setState({ durationMs: Math.max(0, durationMs) });
  }

  destroy() {
    this.destroyed = true;
    this.detachAudio();
    this.msListeners.clear();
    this.stateListeners.clear();
  }
}
