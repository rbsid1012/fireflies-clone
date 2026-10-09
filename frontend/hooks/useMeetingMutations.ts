"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import type { ActionItem, MeetingDetail } from "@/lib/types";
import { meetingKey, useInvalidateLibrary } from "./useMeeting";

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export type ActionItemEdit = {
  text?: string;
  assignee_participant_id?: number | null;
  due_date?: string | null;
};

/**
 * Action item changes apply to the screen immediately and roll back (with a toast) if the server
 * says no, so checking a box feels instant even on a slow connection.
 */
export function useActionItemMutations(meetingId: number) {
  const qc = useQueryClient();
  const invalidateLibrary = useInvalidateLibrary();
  const key = meetingKey(meetingId);

  const patchItems = (fn: (items: ActionItem[], meeting: MeetingDetail) => ActionItem[]) =>
    qc.setQueryData<MeetingDetail>(key, (m) => (m ? { ...m, action_items: fn(m.action_items, m) } : m));

  const begin = async () => {
    await qc.cancelQueries({ queryKey: key });
    return { previous: qc.getQueryData<MeetingDetail>(key) };
  };
  const rollback = (ctx: { previous?: MeetingDetail } | undefined) => ctx?.previous && qc.setQueryData(key, ctx.previous);

  const replace = (saved: ActionItem) => patchItems((items) => items.map((i) => (i.id === saved.id ? saved : i)));

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.patch<ActionItem>(`/api/action-items/${id}`, { is_completed: done }),
    onMutate: async ({ id, done }) => {
      const ctx = await begin();
      patchItems((items) => items.map((i) => (i.id === id ? { ...i, is_completed: done, completed_at: done ? new Date().toISOString() : null } : i)));
      return ctx;
    },
    onError: (e, _v, ctx) => { rollback(ctx); toast.error(message(e, "Couldn't update that action item.")); },
    onSuccess: replace,
    onSettled: invalidateLibrary,
  });

  const edit = useMutation({
    mutationFn: ({ id, ...patch }: ActionItemEdit & { id: number }) => api.patch<ActionItem>(`/api/action-items/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      const ctx = await begin();
      patchItems((items, meeting) => items.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, ...("text" in patch && patch.text ? { text: patch.text } : {}), ...("due_date" in patch ? { due_date: patch.due_date ?? null } : {}) };
        if ("assignee_participant_id" in patch) {
          const who = meeting.participants.find((p) => p.id === patch.assignee_participant_id) ?? null;
          return { ...next, assignee_participant_id: who?.id ?? null, assignee: who };
        }
        return next;
      }));
      return ctx;
    },
    onError: (e, _v, ctx) => { rollback(ctx); toast.error(message(e, "Couldn't save that change.")); },
    onSuccess: replace,
    onSettled: invalidateLibrary,
  });

  const add = useMutation({
    mutationFn: (body: { text: string; assignee_participant_id?: number | null; due_date?: string | null }) =>
      api.post<ActionItem>(`/api/meetings/${meetingId}/action-items`, body),
    onMutate: async (body) => {
      const ctx = await begin();
      const now = new Date().toISOString();
      const tempId = -Date.now();
      patchItems((items, meeting) => [...items, {
        id: tempId, meeting_id: meetingId, text: body.text, assignee_participant_id: body.assignee_participant_id ?? null,
        assignee: meeting.participants.find((p) => p.id === body.assignee_participant_id) ?? null, source_segment_id: null,
        source_start_ms: null, due_date: body.due_date ?? null, is_completed: false, completed_at: null, created_at: now, updated_at: now,
      }]);
      return { ...ctx, tempId };
    },
    onError: (e, _v, ctx) => { rollback(ctx); toast.error(message(e, "Couldn't add that action item.")); },
    onSuccess: (saved, _v, ctx) => patchItems((items) => items.map((i) => (i.id === ctx?.tempId ? saved : i))),
    onSettled: invalidateLibrary,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/action-items/${id}`),
    onMutate: async (id) => {
      const ctx = await begin();
      patchItems((items) => items.filter((i) => i.id !== id));
      return ctx;
    },
    onError: (e, _v, ctx) => { rollback(ctx); toast.error(message(e, "Couldn't delete that action item.")); },
    onSuccess: () => toast.success("Action item deleted"),
    onSettled: invalidateLibrary,
  });

  return { toggle, edit, add, remove };
}

export type MeetingEdit = {
  title?: string;
  started_at?: string;
  tags?: string[];
  participants?: { id: number; person_id?: number | null; name?: string; email?: string | null }[];
};

export function useMeetingMutations(meetingId: number) {
  const qc = useQueryClient();
  const invalidateLibrary = useInvalidateLibrary();
  const setMeeting = (m: MeetingDetail) => qc.setQueryData(meetingKey(meetingId), m);

  const update = useMutation({
    mutationFn: (patch: MeetingEdit) => api.patch<MeetingDetail>(`/api/meetings/${meetingId}`, patch),
    onSuccess: (m) => {
      setMeeting(m);
      qc.invalidateQueries({ queryKey: ["transcript", meetingId] }); // speaker names may have changed
      toast.success("Meeting updated");
    },
    onError: (e) => toast.error(message(e, "Couldn't save your changes.")),
    onSettled: invalidateLibrary,
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/meetings/${meetingId}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: meetingKey(meetingId) });
      toast.success("Meeting deleted");
    },
    onError: (e) => toast.error(message(e, "Couldn't delete the meeting.")),
    onSettled: invalidateLibrary,
  });

  const regenerate = useMutation({
    mutationFn: (opts?: { template?: string; instructions?: string }) => api.post<MeetingDetail>(`/api/meetings/${meetingId}/summary/regenerate`, opts),
    onSuccess: (m) => { setMeeting(m); qc.invalidateQueries({ queryKey: ["suggestions", meetingId] }); toast.success("Summary updated"); },
    onError: (e) => toast.error(message(e, "Couldn't regenerate the summary.")),
    onSettled: invalidateLibrary,
  });

  const attachMedia = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return api.post<MeetingDetail>(`/api/meetings/${meetingId}/media`, form);
    },
    onSuccess: (m) => { setMeeting(m); toast.success("Recording attached"); },
    onError: (e) => toast.error(message(e, "Couldn't upload that file.")),
  });

  const removeMedia = useMutation({
    mutationFn: () => api.delete<MeetingDetail>(`/api/meetings/${meetingId}/media`),
    onSuccess: (m) => { setMeeting(m); toast.success("Recording removed"); },
    onError: (e) => toast.error(message(e, "Couldn't remove the recording.")),
  });

  const exportAs = useMutation({
    mutationFn: (format: "md" | "txt") => downloadFile(`/api/meetings/${meetingId}/export?format=${format}`, `meeting.${format}`),
    onError: (e) => toast.error(message(e, "Couldn't export the meeting.")),
  });

  const identifySpeakers = useMutation({
    mutationFn: () => api.post<MeetingDetail>(`/api/meetings/${meetingId}/speakers/identify`),
    onSuccess: (m) => { setMeeting(m); qc.invalidateQueries({ queryKey: ["transcript", meetingId] }); toast.success(`Found ${m.participants.length} speaker${m.participants.length === 1 ? "" : "s"}`); },
    onError: (e) => toast.error(message(e, "Couldn't tell the speakers apart.")),
    onSettled: invalidateLibrary,
  });

  return { update, remove, regenerate, identifySpeakers, attachMedia, removeMedia, exportAs };
}
