import type { Metadata } from "next";
import { TeamRecordingPage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Team: Recording & Privacy" };

export default function Page() {
  return <TeamRecordingPage />;
}
