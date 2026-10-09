import type { Metadata } from "next";
import { CompliancePage } from "@/components/settings/pages/CompliancePage";

export const metadata: Metadata = { title: "Compliance Notification" };

export default function Page() {
  return <CompliancePage />;
}
