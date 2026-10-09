import { X } from "lucide-react";
import { formatDay } from "@/lib/dates";
import type { LibraryFilters } from "@/lib/library-filters";
import type { Person } from "@/lib/types";

type Props = {
  filters: LibraryFilters;
  people: Person[] | undefined;
  onChange: (patch: Partial<LibraryFilters>) => void;
  onClearAll: () => void;
};

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1.5 text-[13px]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/** One removable chip per active filter, so what is narrowing the list is never hidden. */
export function ActiveFilters({ filters, people, onChange, onClearAll }: Props) {
  const person = people?.find((p) => p.id === filters.participantId);
  const chips: { key: string; label: string; remove: Partial<LibraryFilters> }[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, remove: { q: "" } });
  if (filters.participantId !== null)
    chips.push({ key: "p", label: person?.name ?? `Person #${filters.participantId}`, remove: { participantId: null } });
  if (filters.tag) chips.push({ key: "t", label: `# ${filters.tag}`, remove: { tag: "" } });
  if (filters.from) chips.push({ key: "f", label: `From ${formatDay(filters.from)}`, remove: { from: "" } });
  if (filters.to) chips.push({ key: "to", label: `To ${formatDay(filters.to)}`, remove: { to: "" } });
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={() => onChange(c.remove)} />
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onClearAll} className="px-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
}
