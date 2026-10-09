"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ActionItem, Tasks } from "@/lib/types";

export type TaskFilters = { status: "open" | "done" | "all"; mine: boolean; q: string; page: number };
export const TASK_PAGE_SIZE = 50;

export function useTasks(f: TaskFilters) {
  return useQuery({
    queryKey: ["tasks", f],
    queryFn: () => api.get<Tasks>("/api/tasks", { status: f.status, mine: f.mine, q: f.q, page: f.page, limit: TASK_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

/** Tick a task from the Tasks page. It leaves (or joins) the list at once and comes back if the server refuses. */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.patch<ActionItem>(`/api/action-items/${id}`, { is_completed: done }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Tasks>({ queryKey: ["tasks"] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        const status = (key[1] as TaskFilters).status;
        const leaves = (status === "open" && done) || (status === "done" && !done);
        qc.setQueryData<Tasks>(key, {
          ...data,
          total: leaves ? data.total - 1 : data.total,
          items: leaves ? data.items.filter((t) => t.id !== id) : data.items.map((t) => (t.id === id ? { ...t, is_completed: done } : t)),
          counts: { ...data.counts, open: data.counts.open + (done ? -1 : 1), done: data.counts.done + (done ? 1 : -1) },
        });
      }
      return { snapshots };
    },
    onError: (e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e instanceof ApiError ? e.message : "Couldn't update that task.");
    },
    onSettled: () => {
      for (const key of ["tasks", "meeting", "meetings", "analytics"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
