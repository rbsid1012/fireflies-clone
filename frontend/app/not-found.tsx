import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="That page doesn't exist or has moved."
      action={<Link href="/home" className={cn(buttonVariants({ size: "lg" }), "h-9 px-3.5 text-[14px]")}>Go home</Link>}
    />
  );
}
