"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { UserSettings } from "@/lib/types";

type Patch = { [K in keyof UserSettings]?: Partial<UserSettings[K]> };

export function useSettings() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettings>("/api/settings"),
    enabled: status === "authed",
    staleTime: 60_000,
  });
}

/** Save a partial change. The UI updates at once and rolls back if the server rejects it. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Patch) => api.patch<UserSettings>("/api/settings", patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const previous = qc.getQueryData<UserSettings>(["settings"]);
      if (previous) {
        const next = { ...previous } as Record<string, unknown>;
        for (const [section, values] of Object.entries(patch)) {
          next[section] = { ...(previous as Record<string, object>)[section], ...(values as object) };
        }
        qc.setQueryData(["settings"], next);
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(["settings"], ctx.previous);
    },
    onSuccess: (saved) => {
      qc.setQueryData(["settings"], saved);
      qc.invalidateQueries({ queryKey: ["meetings"] }); // a retention rule may have removed meetings
    },
  });
}
