import type { Metadata } from "next";
import { AppearancePage } from "@/components/settings/pages/AppearancePage";

export const metadata: Metadata = { title: "Language & Appearance" };

export default function Page() {
  return <AppearancePage />;
}
