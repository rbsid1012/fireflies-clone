import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-xl border bg-card text-muted-foreground">
        <Icon className="size-6" strokeWidth={1.5} />
      </div>
      <h2 className="text-[17px] font-medium">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-[14px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
