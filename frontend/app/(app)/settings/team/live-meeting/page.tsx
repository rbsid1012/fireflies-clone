import type { Metadata } from "next";
import { TeamLivePage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Team: Live Meeting" };

export default function Page() {
  return <TeamLivePage />;
}
