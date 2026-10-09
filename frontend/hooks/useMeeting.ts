"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeetingDetail, Transcript, TranscriptSearch } from "@/lib/types";

export const meetingKey = (id: number) => ["meeting", id] as const;
export const transcriptKey = (id: number) => ["transcript", id] as const;

export function useMeeting(id: number) {
  return useQuery({
    queryKey: meetingKey(id),
    queryFn: () => api.get<MeetingDetail>(`/api/meetings/${id}`),
    // Poll while it is still being processed, so the page fills in by itself
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
  });
}

/** The transcript never changes after creation (only the speakers' names can), so it is cached for a long time. */
export function useTranscript(id: number) {
  return useQuery({ queryKey: transcriptKey(id), queryFn: () => api.get<Transcript>(`/api/meetings/${id}/transcript`), staleTime: 5 * 60_000 });
}

/** Matches for `q` within one meeting (offsets come from the server's FTS, so stemming is respected). */
export function useTranscriptSearch(id: number, q: string) {
  return useQuery({
    queryKey: ["transcript-search", id, q],
    queryFn: () => api.get<TranscriptSearch>(`/api/meetings/${id}/transcript/search`, { q }),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
  });
}

/** After anything that changes what lists show (counts, titles, tags, who attended). */
export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["meetings", "tags", "people", "tasks", "analytics"]) qc.invalidateQueries({ queryKey: [key] });
  };
}
