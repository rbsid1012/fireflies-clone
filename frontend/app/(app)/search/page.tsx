import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchResults } from "@/components/search/SearchResults";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <h1 className="mb-6 text-[26px] font-medium tracking-tight">Search</h1>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
