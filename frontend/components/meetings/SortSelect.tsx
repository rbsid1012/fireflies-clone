import { NativeSelect } from "@/components/ui/native-select";
import { SORT_OPTIONS, type SortKey } from "@/lib/library-filters";

export function SortSelect({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  return (
    <NativeSelect
      aria-label="Sort meetings"
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      className="w-[148px]"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}
