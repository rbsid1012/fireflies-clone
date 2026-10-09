import type { Metadata } from "next";
import { TeamCompliancePage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Team: Compliance Notification" };

export default function Page() {
  return <TeamCompliancePage />;
}
