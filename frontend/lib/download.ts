import { API_URL, ApiError } from "./api";
import { getToken } from "./auth-storage";

/** Download an authenticated file. A plain <a href> can't send the Authorization header, so fetch it as a blob. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) {
    let message = res.statusText;
    try { message = ((await res.json()) as { detail?: string }).detail ?? message; } catch { /* not JSON */ }
    throw new ApiError(res.status, "download_failed", message || "Download failed");
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
