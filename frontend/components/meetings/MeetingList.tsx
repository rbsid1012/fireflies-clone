import { groupByDay } from "@/lib/group-meetings";
import type { MeetingListItem } from "@/lib/types";
import { MeetingCard } from "./MeetingCard";

type Props = {
  items: MeetingListItem[];
  /** Day headings only make sense when the list is in date order. */
  grouped: boolean;
};

export function MeetingList({ items, grouped }: Props) {
  if (!grouped) {
    return (
      <ul className="space-y-5">
        {items.map((m) => (
          <li key={m.id}><MeetingCard meeting={m} /></li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-5">
      {groupByDay(items).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="mb-5 px-1 text-[14px] text-muted-foreground">{group.label}</h2>
          <ul className="space-y-5">
            {group.items.map((m) => (
              <li key={m.id}><MeetingCard meeting={m} /></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
