/** Typed fetch client for the FastAPI backend. */
import { clearToken, getToken } from "./auth-storage";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** The backend always fails with `{ detail, code }`; this carries both plus the HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { detail?: unknown; code?: unknown };
    return new ApiError(res.status, String(body.code ?? "error"), String(body.detail ?? res.statusText));
  } catch {
    return new ApiError(res.status, "error", res.statusText || "Request failed");
  }
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    // fetch only rejects on network failure (server down, CORS, cold start), never on HTTP errors
    throw new ApiError(0, "network_error", "Can't reach the server.");
  }
  if (!res.ok) {
    const error = await parseError(res);
    // An expired or revoked session: drop the token so the app sends the user back to the login page
    if (res.status === 401 && token && (error.code === "invalid_token" || error.code === "not_authenticated")) clearToken();
    throw error;
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Where uploaded media is served from: the API returns paths like /api/media/3?sig=... */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
};

/**
 * POST multipart data with upload progress (fetch can't report it, XMLHttpRequest can).
 * Resolves with the parsed JSON, or rejects with the same ApiError shape as the rest of the client.
 */
export function uploadForm<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, "network_error", "Can't reach the server."));
    xhr.onabort = () => reject(new ApiError(0, "aborted", "The upload was cancelled."));
    xhr.onload = () => {
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
      const err = (body ?? {}) as { detail?: unknown; code?: unknown };
      if (xhr.status === 401 && token && (err.code === "invalid_token" || err.code === "not_authenticated")) clearToken();
      reject(new ApiError(xhr.status, String(err.code ?? "error"), String(err.detail ?? (xhr.statusText || "Upload failed"))));
    };
    xhr.send(form);
  });
}
