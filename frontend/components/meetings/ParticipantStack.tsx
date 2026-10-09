import { SpeakerAvatar } from "@/components/transcript/SpeakerAvatar";
import type { Participant } from "@/lib/types";

/** Overlapping speaker avatars with a "+N" overflow chip. */
export function ParticipantStack({ participants, max = 4 }: { participants: Participant[]; max?: number }) {
  const shown = participants.slice(0, max);
  const extra = participants.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5" aria-label={`${participants.length} participants`}>
      {shown.map((p) => (
        <SpeakerAvatar key={p.id} name={p.name} colorIndex={p.color_index} className="ring-2 ring-card" />
      ))}
      {extra > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}
