import { Suspense } from "react";
import type { Metadata } from "next";
import { TasksView } from "@/components/tasks/TasksView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <h1 className="text-[26px] font-medium tracking-tight">Tasks</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted-foreground">Every action item from every meeting, in one place.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TasksView />
      </Suspense>
    </div>
  );
}
