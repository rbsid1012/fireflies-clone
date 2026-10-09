import type { Metadata } from "next";
import { AiSkillsPage } from "@/components/skills/AiSkillsPage";

export const metadata: Metadata = { title: "AI Skills" };

export default function Page() {
  return <AiSkillsPage />;
}
