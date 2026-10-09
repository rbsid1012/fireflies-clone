"use client";

import { ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NativeSelect } from "@/components/ui/native-select";
import { usePeople, useTags } from "@/hooks/useLibraryData";
import { SORT_OPTIONS, type LibraryFilters, type SortKey } from "@/lib/library-filters";
import { cn } from "@/lib/utils";

type Props = { filters: LibraryFilters; onChange: (patch: Partial<LibraryFilters>) => void };

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const dateInput =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/** Participant, tag and date-range filters in a popover. Every change is applied immediately. */
export function MeetingFilters({ filters, onChange }: Props) {
  const people = usePeople();
  const tags = useTags();
  const count = [filters.participantId !== null, filters.tag, filters.from, filters.to].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-3.5 text-[14px] text-fg2 outline-none transition-colors",
          "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-accent",
        )}
      >
        <ListFilter className="size-4 text-muted-foreground" strokeWidth={1.5} />
        Filters
        {count > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-medium leading-5 text-primary-foreground">
            {count}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(92vw,340px)] gap-4 p-4">
        <Field label="Participant" htmlFor="filter-participant">
          <NativeSelect
            id="filter-participant"
            value={filters.participantId ?? ""}
            disabled={people.isPending}
            onChange={(e) => onChange({ participantId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Anyone</option>
            {people.data?.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.meeting_count})</option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Tag" htmlFor="filter-tag">
          <NativeSelect
            id="filter-tag"
            value={filters.tag}
            disabled={tags.isPending}
            onChange={(e) => onChange({ tag: e.target.value })}
          >
            <option value="">Any tag</option>
            {tags.data?.map((t) => (
              <option key={t.id} value={t.name}>{t.name} ({t.meeting_count})</option>
            ))}
          </NativeSelect>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="filter-from">
            <input
              id="filter-from" type="date" className={dateInput} value={filters.from}
              max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })}
            />
          </Field>
          <Field label="To" htmlFor="filter-to">
            <input
              id="filter-to" type="date" className={dateInput} value={filters.to}
              min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Sort by" htmlFor="filter-sort">
          <NativeSelect id="filter-sort" value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ participantId: null, tag: "", from: "", to: "" })}
            className="self-start text-[13px] text-primary-foreground/80 underline-offset-4 hover:underline"
          >
            Reset filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
