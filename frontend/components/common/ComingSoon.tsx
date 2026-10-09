import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

type Props = { icon: LucideIcon; title: string; description: string; planned?: string[] };

/** Placeholder for a page that exists in the nav but isn't built yet. */
export function ComingSoon({ icon, title, description, planned }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={
          <Link href="/home" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-9 gap-2 px-3.5 text-[14px]")}>
            <ArrowLeft className="size-4" /> Back home
          </Link>
        }
      />
      {planned && planned.length > 0 && (
        <ul className="mx-auto -mt-6 max-w-md space-y-1.5 pb-12 text-[13px] text-muted-foreground">
          {planned.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
