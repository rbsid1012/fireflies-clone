import type { Metadata } from "next";
import { UpgradePage } from "@/components/skills/UpgradePage";

export const metadata: Metadata = { title: "Upgrade" };

export default function Page() {
  return <UpgradePage />;
}
