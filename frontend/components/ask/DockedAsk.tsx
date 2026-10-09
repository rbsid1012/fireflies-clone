"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AskPanel } from "./AskPanel";

/** Fred across all meetings: docked on the right at wide widths, a floating button + sheet below that. */
export function DockedAsk({ scopeLabel, variant }: { scopeLabel?: string; variant?: "home" | "library" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="sticky top-0 hidden h-[calc(100dvh-var(--chrome-h,3.25rem))] w-[420px] shrink-0 self-start border-l xl:block">
        <AskPanel meetingId={null} scopeLabel={scopeLabel} variant={variant} />
      </div>
      <Button
        variant="outline" size="lg" onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-10 gap-2 rounded-full bg-card px-4 text-[14px] shadow-lg xl:hidden"
      ><Bot className="size-4 text-iris-soft" /> Ask Fred</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" showCloseButton className="w-[min(92vw,400px)] gap-0 p-0 sm:max-w-[400px]">
          <SheetTitle className="sr-only">Ask Fred</SheetTitle>
          <AskPanel meetingId={null} scopeLabel={scopeLabel} variant={variant} />
        </SheetContent>
      </Sheet>
    </>
  );
}
