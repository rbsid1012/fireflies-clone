import type { Metadata } from "next";
import { RecordingPrivacyPage } from "@/components/settings/pages/RecordingPrivacyPage";

export const metadata: Metadata = { title: "Recording & Privacy" };

export default function Page() {
  return <RecordingPrivacyPage />;
}
