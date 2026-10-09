import type { Metadata } from "next";
import { LiveAssistPage } from "@/components/settings/pages/NotAvailablePages";

export const metadata: Metadata = { title: "Live Assist" };

export default function Page() {
  return <LiveAssistPage />;
}
