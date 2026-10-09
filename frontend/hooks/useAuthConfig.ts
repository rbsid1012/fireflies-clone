"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AuthConfig } from "@/lib/types";

/** What the login screen can offer on this server (Google sign-in, demo login). Public endpoint. */
export function useAuthConfig() {
  return useQuery({ queryKey: ["auth-config"], queryFn: () => api.get<AuthConfig>("/api/auth/config"), staleTime: 10 * 60_000 });
}
