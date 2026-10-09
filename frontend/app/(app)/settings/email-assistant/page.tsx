import type { Metadata } from "next";
import { EmailAssistantPage } from "@/components/settings/pages/NotAvailablePages";

export const metadata: Metadata = { title: "Email Assistant" };

export default function Page() {
  return <EmailAssistantPage />;
}
