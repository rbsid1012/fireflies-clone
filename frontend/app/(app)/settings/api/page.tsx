import type { Metadata } from "next";
import { ApiPage } from "@/components/settings/pages/ApiPage";

export const metadata: Metadata = { title: "MCP & API" };

export default function Page() {
  return <ApiPage />;
}
