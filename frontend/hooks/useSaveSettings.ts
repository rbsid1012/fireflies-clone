"use client";

import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { useUpdateSettings } from "./useSettings";

type Patch = { [K in keyof UserSettings]?: Partial<UserSettings[K]> };

/** Save a settings change with a small confirmation (or the server's reason if it is refused). */
export function useSaveSettings() {
  const update = useUpdateSettings();
  return {
    save: (patch: Patch, onDone?: () => void) =>
      update.mutate(patch, {
        onSuccess: () => { toast.success("Saved", { id: "settings-saved", duration: 1500 }); onDone?.(); },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save that setting."),
      }),
    saving: update.isPending,
  };
}
