import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/meetings/MeetingDetail";

export const metadata: Metadata = { title: "Meeting" };

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return (
    <div className="h-full">
      <MeetingDetail id={Number(id)} />
    </div>
  );
}
