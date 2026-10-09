import type { Metadata } from "next";
import { SecurityPage } from "@/components/settings/pages/SecurityPage";

export const metadata: Metadata = { title: "Security overview" };

export default function Page() {
  return <SecurityPage />;
}
