"use client";

import { Bell, Clock, Languages, ListChecks, Video, Trash2 } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { EmailOutbox } from "./EmailOutbox";
import { Group, Row, SettingsPage } from "../primitives";

const LANGUAGES = [["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"], ["it", "Italian"], ["nl", "Dutch"], ["hi", "Hindi"], ["ja", "Japanese"], ["zh", "Chinese"]];
const RETENTION = [["", "Keep forever"], ["30", "After 30 days"], ["90", "After 90 days"], ["180", "After 6 months"], ["365", "After 1 year"]];

export function RecordingPrivacyPage() {
  const { data } = useSettings();
  const { save } = useSaveSettings();
  if (!data) return <SettingsPage title="Recording & Privacy"><Skeleton className="h-64 w-full" /></SettingsPage>;
  const { recording, email } = data;
  const retention = recording.auto_delete_days === null || recording.auto_delete_days === undefined ? "" : String(recording.auto_delete_days);

  return (
    <SettingsPage title="Recording & Privacy" description="What happens to your meetings, and what you get by email.">
      <Group title="Recording">
        <Row icon={Video} title="Auto-record calendar meetings" description="A notetaker joins your calendar events. This app works from transcripts you add, so there is nothing to record yet." badge="Coming soon" disabled />
        <Row icon={Video} title="Capture meeting video" description="Keep the screen and shared content as video." badge="Coming soon" disabled />
        <Row icon={Languages} title="Meeting language" description="The language summaries and answers are written in, when an AI model is configured on the server.">
          <NativeSelect aria-label="Meeting language" value={recording.meeting_language} onChange={(e) => save({ recording: { meeting_language: e.target.value as typeof recording.meeting_language } })} className="w-[190px]">
            {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </NativeSelect>
        </Row>
        <Row icon={Trash2} title="Auto-delete meetings" description="Remove meetings, with their recordings, once they are older than this. It takes effect straight away.">
          <NativeSelect aria-label="Auto-delete meetings" value={retention} onChange={(e) => save({ recording: { auto_delete_days: e.target.value ? Number(e.target.value) : null } })} className="w-[190px]">
            {RETENTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </NativeSelect>
        </Row>
      </Group>

      <Group title="Email notification" id="email">
        <Row icon={ListChecks} title="Meeting recap email" description="Sent after each meeting is added and processed.">
          <NativeSelect aria-label="Send the recap to" value={email.recap_recipients} onChange={(e) => save({ email: { recap_recipients: e.target.value as typeof email.recap_recipients } })} className="w-[230px]">
            <option value="me">Only me</option>
            <option value="participants">Me and participants with an email</option>
            <option value="none">Don&apos;t send</option>
          </NativeSelect>
        </Row>
        <Row icon={Bell} title="What to include" description="Participants only get what you choose here.">
          <NativeSelect aria-label="What to include in the recap" value={email.recap_include} disabled={email.recap_recipients === "none"} onChange={(e) => save({ email: { recap_include: e.target.value as typeof email.recap_include } })} className="w-[230px]">
            <option value="overview">Overview</option>
            <option value="overview_actions">Overview and action items</option>
            <option value="full">Everything</option>
          </NativeSelect>
        </Row>
        <Row icon={Clock} title="Meeting-prep email" description="A reminder before recurring meetings. It needs a calendar connection." badge="Coming soon" disabled />
      </Group>

      <EmailOutbox />
    </SettingsPage>
  );
}
