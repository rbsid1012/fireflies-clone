"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { Group, Row, SettingsPage } from "../primitives";

function Announcement({ initial }: { initial: string }) {
  const { save, saving } = useSaveSettings();
  const [text, setText] = useState(initial);
  const dirty = text.trim() !== initial;
  return (
    <div className="space-y-2">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} aria-label="Announcement text"
        className="w-full resize-y rounded-lg border border-input bg-background p-3 text-[14px] leading-6 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span>{text.length}/300</span>
        <button type="button" disabled={!dirty || saving || !text.trim()} onClick={() => save({ compliance: { announcement: text.trim() } })}
          className="rounded-lg bg-primary px-3.5 py-1.5 text-[14px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}

export function CompliancePage() {
  const { data } = useSettings();
  const { save } = useSaveSettings();
  if (!data) return <SettingsPage title="Compliance Notification"><Skeleton className="h-48 w-full" /></SettingsPage>;
  const c = data.compliance;
  return (
    <SettingsPage title="Compliance Notification" description="Let people know a meeting was recorded and transcribed.">
      <Group title="Participants">
        <Row icon={BellRing} title="Tell participants" description="Add a short notice to recap emails that go to people other than you.">
          <Switch checked={c.notify_participants} onCheckedChange={(v) => save({ compliance: { notify_participants: v } })} aria-label="Tell participants" />
        </Row>
        <Row title="Notice text" description="Shown in the email under the meeting details." stacked disabled={!c.notify_participants}>
          <Announcement key={c.announcement} initial={c.announcement} />
        </Row>
      </Group>
    </SettingsPage>
  );
}
