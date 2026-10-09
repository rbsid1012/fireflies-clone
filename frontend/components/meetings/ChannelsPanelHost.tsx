"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { filtersToParams, parseFilters, withFilters } from "@/lib/library-filters";
import { ChannelsPanel, type ChannelView } from "./ChannelsPanel";

/** The channels column beside the top bar. Reads and writes the library's URL, so it works from the app shell. */
export function ChannelsPanelHost() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const view: ChannelView = params.get("view") === "all" ? "all" : "mine";

  return (
    <ChannelsPanel
      activeTag={filters.tag} source={filters.source} view={view}
      onSelect={({ tag, source, view: v }) => {
        const next = filtersToParams(withFilters(filters, { tag: tag ?? filters.tag, source: source ?? filters.source }));
        if (v === "all") next.set("view", "all");
        const qs = next.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    />
  );
}
