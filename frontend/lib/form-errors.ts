import { HOME_PATH } from "./routes";

/** The API reports validation problems as "field: message; other: message". Split that per field. */
export function fieldErrors(detail: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of detail.split("; ")) {
    const m = /^([a-z_]+): (.+)$/i.exec(part);
    if (m && !(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Where to go after signing in. Only same-site paths are allowed: `?next=//evil.com` or
 * `?next=https://evil.com` would otherwise turn the login page into an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = HOME_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(login|signup|forgot-password|reset-password)(\/|\?|$)/.test(next)) return fallback;
  return next;
}
