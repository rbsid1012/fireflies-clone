import type { Metadata } from "next";
import { TeamRulesPage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Team: Rules" };

export default function Page() {
  return <TeamRulesPage />;
}
