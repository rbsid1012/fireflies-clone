"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type BackendStatus = "ok" | "waking" | "down";

/**
 * Free hosts sleep when idle, so the first request can take many seconds. Report that as
 * "waking" (slow, still trying) instead of leaving the user with a blank app, and as "down"
 * once a request has actually failed. Keeps retrying until the API answers.
 */
export function useBackendStatus(slowAfterMs = 2500): BackendStatus {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<{ status: string }>("/api/health"),
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? 4000 : false),
  });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (health.status !== "pending") return;
    const timer = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [health.status, slowAfterMs]);

  if (health.status === "error") return "down";
  if (health.status === "pending" && slow) return "waking";
  return "ok";
}
