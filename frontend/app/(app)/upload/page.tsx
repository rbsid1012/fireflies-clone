import type { Metadata } from "next";
import { UploadForm } from "@/components/upload/UploadForm";

export const metadata: Metadata = { title: "Uploads" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <UploadForm initialMode={tab === "paste" ? "paste" : "file"} />;
}
