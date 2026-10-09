import type { Metadata } from "next";
import { TeamAIPage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Team: AI Settings" };

export default function Page() {
  return <TeamAIPage />;
}
