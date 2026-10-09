"use client";

import Link from "next/link";
import { ChevronDown, ClipboardPaste, FileUp, Radio, Video } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const base = "inline-flex h-8 items-center bg-primary text-[14px] font-normal text-white outline-none transition-colors hover:bg-[#6c47ea] focus-visible:ring-2 focus-visible:ring-ring/50";

/** 32px split button: "Capture" (97px) | divider | chevron (28px). Adding a meeting means uploading its transcript or recording; live capture isn't part of this app. */
export function CaptureButton() {
  return (
    <div className="flex h-8 overflow-hidden rounded-md">
      <Link href="/upload" className={cn(base, "w-[97px] justify-center gap-2")}>
        <Video className="size-5" strokeWidth={1.5} /> <span className="hidden sm:inline">Capture</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More ways to add a meeting" className={cn(base, "w-[28.5px] justify-center border-l border-white/20")}>
          <ChevronDown className="size-4" strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem render={<Link href="/upload" />} className="h-9 px-3 text-[14px]"><FileUp /> Upload a recording or transcript</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/upload?tab=paste" />} className="h-9 px-3 text-[14px]"><ClipboardPaste /> Paste a transcript</DropdownMenuItem>
          <DropdownMenuItem disabled className="h-9 px-3 text-[14px]"><Radio /> Record a live meeting <span className="ml-auto text-[11px] text-muted-foreground">Not available</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
