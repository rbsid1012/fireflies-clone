import { tagDotClass } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

export function TagPill({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[12px] leading-none text-muted-foreground", className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tagDotClass(color))} />
      {name}
    </span>
  );
}
