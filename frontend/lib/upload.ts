/** Client-side checks that give instant feedback; the server validates everything again. */

export const TRANSCRIPT_EXTENSIONS = [".txt", ".vtt", ".srt", ".json"] as const;
export const MEDIA_EXTENSIONS = [".mp3", ".m4a", ".wav", ".mp4", ".webm", ".ogg", ".aac", ".mov"] as const;
export const MAX_TRANSCRIPT_BYTES = 5_000_000;
export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** An error message, or null when the file looks fine. */
export function validateTranscriptFile(file: { name: string; size: number }): string | null {
  const ext = extensionOf(file.name);
  if (!(TRANSCRIPT_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported file type '${ext || file.name}'. Use ${TRANSCRIPT_EXTENSIONS.join(", ")}.`;
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_TRANSCRIPT_BYTES) return `That transcript is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_TRANSCRIPT_BYTES)}.`;
  return null;
}

export function validateMediaFile(file: { name: string; size: number }): string | null {
  const ext = extensionOf(file.name);
  if (!(MEDIA_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported recording type '${ext || file.name}'. Use ${MEDIA_EXTENSIONS.join(", ")}.`;
  }
  if (file.size === 0) return "That recording is empty.";
  if (file.size > MAX_MEDIA_BYTES) return `That recording is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_MEDIA_BYTES)}.`;
  return null;
}

/** "q4_launch-planning.vtt" -> "q4 launch planning" (same rule as the server's default title). */
export function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, " ").trim();
  return stem.slice(0, 255);
}

/** A value for <input type="datetime-local"> for "now" in the viewer's time zone. */
export function nowLocalInput(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
}

export const SAMPLE_TRANSCRIPT = `[00:00:04] Dana: Thanks for joining. Today we need to pick a launch date for the new dashboard.
[00:00:12] Eli: I'd propose the first week of November. Design is done, and engineering needs two more weeks.
[00:00:25] Dana: That works. Eli, can you confirm the date with QA by Friday?
[00:00:33] Eli: I'll confirm with QA tomorrow and send everyone the schedule.
[00:00:44] Priya: I'll prepare the announcement email and the help-center article before launch.
[00:00:55] Dana: Great. Let's make sure support has the release notes at least a week ahead.`;
