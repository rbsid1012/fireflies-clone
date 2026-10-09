"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Soundbite } from "@/lib/types";

const key = (meetingId: number) => ["soundbites", meetingId] as const;
const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function useSoundbites(meetingId: number) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: key(meetingId),
    queryFn: () => api.get<{ items: Soundbite[] }>(`/api/meetings/${meetingId}/soundbites`).then((r) => r.items),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key(meetingId) });

  const create = useMutation({
    mutationFn: (v: { start_segment_id: number; end_segment_id?: number; note?: string }) => api.post<Soundbite>(`/api/meetings/${meetingId}/soundbites`, v),
    onSuccess: () => { toast.success("Soundbite saved"); refresh(); },
    onError: (e) => toast.error(message(e, "Couldn't save that soundbite.")),
  });
  const setNote = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => api.patch<Soundbite>(`/api/soundbites/${id}`, { note }),
    onSuccess: refresh,
    onError: (e) => toast.error(message(e, "Couldn't save the note.")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/soundbites/${id}`),
    onSuccess: () => { toast.success("Soundbite removed"); refresh(); },
    onError: (e) => toast.error(message(e, "Couldn't remove that soundbite.")),
  });
  return { soundbites: list.data ?? [], isPending: list.isPending, isError: list.isError, create, setNote, remove };
}
