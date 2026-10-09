"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingCount } from "@/hooks/useMe";
import { pageTitle } from "@/lib/nav";
import { CaptureButton } from "./CaptureButton";
import { NotificationsBell } from "./NotificationsBell";
import { SearchBox } from "./SearchBox";

/** 52px bar: page title, a 319px search box at a fixed offset, then plan chip, Upgrade, bell and Capture. */
export function Topbar({ onOpenMenu, searchLeft = 261, hideTitle }: { onOpenMenu: () => void; searchLeft?: number; hideTitle?: boolean }) {
  const title = pageTitle(usePathname());
  const count = useMeetingCount();
  return (
    <header className="relative flex h-[52px] shrink-0 items-center border-b border-border bg-surface pl-3 pr-3">
      <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu className="size-5" strokeWidth={1.5} />
      </Button>
      {!hideTitle && <p className="hidden min-w-0 shrink-0 text-[14px] text-muted-foreground md:block">{title}</p>}

      <div className="absolute top-[9px] hidden w-[319px] md:block" style={{ left: searchLeft }}>
        <Suspense fallback={<div className="h-[34px] rounded-lg border border-input bg-card" />}>
          <SearchBox />
        </Suspense>
      </div>
      <div className="min-w-0 flex-1 md:hidden"><Suspense fallback={null}><SearchBox /></Suspense></div>

      <div className="ml-auto flex items-center">
        <Link href="/meetings" className="mr-[18px] hidden items-center gap-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground lg:flex" aria-label="Meetings in your library">
          <span className="grid size-4 place-items-center rounded-[4px] bg-[#3d6649] text-[12px] font-medium leading-none tabular-nums text-white">{count.data ?? "–"}</span>
          Meetings
        </Link>
        <Link href="/upgrade" className="hidden h-[34px] items-center rounded-md border border-success-foreground/30 bg-success px-[11px] text-[14px] text-success-foreground transition-colors hover:bg-success/70 sm:flex">Upgrade</Link>
        <span aria-hidden="true" className="mx-[17px] hidden h-5 w-px bg-input sm:block" />
        <NotificationsBell />
        <span className="ml-[18px]"><CaptureButton /></span>
      </div>
    </header>
  );
}
