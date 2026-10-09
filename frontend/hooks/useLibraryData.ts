"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toApiQuery, type LibraryFilters } from "@/lib/library-filters";
import type { MeetingListItem, Page, Person, Tag } from "@/lib/types";

/** The filtered, sorted page of meetings. Keeps showing the previous page while the next loads. */
export function useMeetings(filters: LibraryFilters) {
  return useQuery({
    queryKey: ["meetings", "list", filters],
    queryFn: () => api.get<Page<MeetingListItem>>("/api/meetings", toApiQuery(filters)),
    placeholderData: keepPreviousData,
  });
}

/** People in the library, for the participant filter. */
export function usePeople() {
  return useQuery({ queryKey: ["people"], queryFn: () => api.get<Person[]>("/api/people"), staleTime: 60_000 });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => api.get<Tag[]>("/api/tags"), staleTime: 60_000 });
}
