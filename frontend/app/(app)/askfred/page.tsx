import type { Metadata } from "next";
import { AskFredPage } from "@/components/askfred/AskFredPage";

export const metadata: Metadata = { title: "AskFred" };

export default function Page() {
  return <AskFredPage />;
}
