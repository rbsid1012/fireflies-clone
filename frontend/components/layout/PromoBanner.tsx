"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";

/** The 40px strip above the app, dismissible. Says what this build actually offers. */
export function PromoBanner() {
  const [dismissed, setDismissed] = usePersistentFlag("promo-banner-dismissed");
  if (dismissed) return null;
  return (
    <div className="relative flex h-10 shrink-0 items-center justify-center gap-2 bg-banner px-10 text-[14px] text-foreground">
      <span className="truncate">Every feature is unlocked in this demo. There are no plans or limits.</span>
      <Link href="/upgrade" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-iris hover:underline">
        See what&apos;s included <ArrowRight className="size-4" strokeWidth={1.5} />
      </Link>
      <button
        type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      ><X className="size-4" strokeWidth={1.5} /></button>
    </div>
  );
}
