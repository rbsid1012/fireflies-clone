import { Suspense } from "react";
import type { Metadata } from "next";
import { MeetingLibrary } from "@/components/meetings/MeetingLibrary";
import { LibraryPageSkeleton } from "@/components/meetings/MeetingListSkeleton";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  // MeetingLibrary reads the URL's search params, which requires a Suspense boundary
  return (
    <Suspense fallback={<LibraryPageSkeleton />}>
      <MeetingLibrary />
    </Suspense>
  );
}
