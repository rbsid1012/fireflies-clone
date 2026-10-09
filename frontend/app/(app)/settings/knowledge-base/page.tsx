import type { Metadata } from "next";
import { KnowledgeBasePage } from "@/components/settings/pages/KnowledgeBasePage";

export const metadata: Metadata = { title: "Knowledge Base" };

export default function Page() {
  return <KnowledgeBasePage />;
}
