import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <h1 className="text-[26px] font-medium tracking-tight">Analytics</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted-foreground">How your meetings are going: time, topics and follow-through.</p>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <AnalyticsView />
      </Suspense>
    </div>
  );
}
