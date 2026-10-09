import type { Metadata } from "next";
import { AISettingsPage } from "@/components/settings/pages/AISettingsPage";

export const metadata: Metadata = { title: "AI Settings" };

export default function Page() {
  return <AISettingsPage />;
}
