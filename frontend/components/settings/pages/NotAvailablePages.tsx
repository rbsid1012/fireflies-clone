import { Mail, Radio, Users } from "lucide-react";
import { NotAvailable, SettingsPage } from "../primitives";

export function EmailAssistantPage() {
  return (
    <SettingsPage title="Email Assistant">
      <NotAvailable icon={Mail} title="Not part of this version">
        An assistant that drafts replies and follow-ups in your inbox needs a Gmail connection, which this app doesn&apos;t have. You still get a recap email for every meeting. Choose who receives it under Recording & Privacy.
      </NotAvailable>
    </SettingsPage>
  );
}

export function LiveAssistPage() {
  return (
    <SettingsPage title="Live Assist">
      <NotAvailable icon={Radio} title="Not part of this version">
        Live suggestions during a call need a bot that joins meetings in real time. This app works from transcripts you add after the fact. Ask Fred already answers questions about any finished meeting.
      </NotAvailable>
    </SettingsPage>
  );
}

export function TeamPage() {
  return (
    <SettingsPage title="Team">
      <NotAvailable icon={Users} title="Teams are not part of this version">
        Every account is personal: meetings, people and tags are private to you. Sharing a workspace with teammates is on the roadmap.
      </NotAvailable>
    </SettingsPage>
  );
}
