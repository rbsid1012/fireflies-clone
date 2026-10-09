import { cn } from "@/lib/utils";

// Full class names so Tailwind keeps them; indexed by meeting_participants.color_index
const COLORS = ["bg-speaker-0", "bg-speaker-1", "bg-speaker-2", "bg-speaker-3", "bg-speaker-4", "bg-speaker-5"];

export function speakerColorClass(colorIndex: number): string {
  return COLORS[((colorIndex % COLORS.length) + COLORS.length) % COLORS.length];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type Props = { name: string; colorIndex: number; className?: string };

/** A person's consistent colour within one meeting. Decorative: the name is always shown nearby. */
export function SpeakerAvatar({ name, colorIndex, className }: Props) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-black/80",
        speakerColorClass(colorIndex),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
