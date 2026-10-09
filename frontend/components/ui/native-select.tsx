import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A styled native <select>: accessible, keyboard- and mobile-friendly with no extra machinery. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-9 text-[14px] outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
    </div>
  );
}
