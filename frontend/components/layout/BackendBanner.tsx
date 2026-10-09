"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { API_URL } from "@/lib/api";

/** Slim notice shown only while the API is slow to wake up or unreachable. */
export function BackendBanner() {
  const status = useBackendStatus();
  if (status === "ok") return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-banner px-4 py-1.5 text-center text-[13px] text-foreground/90">
      {status === "waking" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Waking up the server. Free hosts sleep when idle, so the first load can take up to a minute.
        </>
      ) : (
        <>
          <WifiOff className="size-3.5" />
          Can&apos;t reach the API at {API_URL}. Retrying…
        </>
      )}
    </div>
  );
}
