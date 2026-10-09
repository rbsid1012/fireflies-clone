"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Page, MeetingListItem } from "@/lib/types";

/** Total meetings in the library (a limit=1 list request, so it stays cheap). */
export function useMeetingCount() {
  return useQuery({
    queryKey: ["meetings", "count"],
    queryFn: async () => (await api.get<Page<MeetingListItem>>("/api/meetings", { limit: 1 })).total,
    staleTime: 30_000,
  });
}
