import type { Metadata } from "next";
import { VoiceAgentsPage } from "@/components/skills/VoiceAgentsPage";

export const metadata: Metadata = { title: "Voice Agents" };

export default function Page() {
  return <VoiceAgentsPage />;
}
