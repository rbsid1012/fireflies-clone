"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useMeetingMutations } from "@/hooks/useMeetingMutations";
import type { MeetingDetail } from "@/lib/types";

export function DeleteDialog({ meeting, open, onOpenChange }: { meeting: MeetingDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { remove } = useMeetingMutations(meeting.id);
  const items = meeting.action_items.length;
  return (
    <ConfirmDialog
      open={open} onOpenChange={onOpenChange} title="Delete this meeting?" confirmLabel="Delete meeting" pending={remove.isPending}
      description={<>“{meeting.title}” will be permanently deleted with its transcript, summary{items > 0 && <>, {items} action item{items === 1 ? "" : "s"}</>}{meeting.media_url && <> and recording</>}. This can&apos;t be undone.</>}
      onConfirm={() => remove.mutate(undefined, { onSuccess: () => router.replace("/meetings") })}
    />
  );
}
