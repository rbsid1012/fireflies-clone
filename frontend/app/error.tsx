"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description={error.message || "An unexpected error occurred."}
      action={<Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => retry()}>Try again</Button>}
    />
  );
}
