"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";
import { cn } from "@/lib/utils";
import { BackendBanner } from "./BackendBanner";
import { PromoBanner } from "./PromoBanner";
import { ShellProvider } from "./ShellContext";
import { ChatsPanel } from "@/components/askfred/ChatsPanel";
import { AskFredProvider } from "@/components/askfred/AskFredContext";
import { ChannelsPanelHost } from "@/components/meetings/ChannelsPanelHost";
import { SidebarBody } from "./SidebarBody";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistentFlag("sidebar-collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  // A meeting has its own top bar and no permanent sidebar (the menu button opens it as a drawer)
  const pathname = usePathname();
  const onSettings = pathname.startsWith("/settings");
  const onMeeting = /^\/meetings\/\d+/.test(pathname) || onSettings;
  // The library keeps the sidebar as a rail and gives its room to the channels column
  const onLibrary = pathname === "/meetings";
  const onAsk = pathname.startsWith("/askfred");
  const rail = collapsed || onLibrary || onAsk;
  const [bannerGone] = usePersistentFlag("promo-banner-dismissed");

  // --chrome-h is the height of everything above the page, so pages can size sticky panels
  return (
    <AskFredProvider><div className="flex h-dvh flex-col overflow-hidden" style={{ "--chrome-h": bannerGone ? "3.25rem" : "5.75rem" } as React.CSSProperties}>
      <PromoBanner />
      <div className="flex min-h-0 flex-1">
        {/* Desktop: fixed sidebar that collapses to an icon rail */}
        <aside className={cn("hidden shrink-0 transition-[width] duration-200", !onMeeting && "md:block", rail ? "w-14" : "w-[232px]")}>
          <SidebarBody collapsed={rail} forced={onLibrary || onAsk} onToggleCollapsed={() => setCollapsed(!collapsed)} />
        </aside>
        {onAsk && (
          <aside className="hidden w-[279px] shrink-0 border-r border-border bg-background lg:block"><ChatsPanel /></aside>
        )}
        {onLibrary && (
          <aside className="hidden w-[248px] shrink-0 border-r border-border bg-background lg:block">
            <Suspense><ChannelsPanelHost /></Suspense>
          </aside>
        )}

        {/* Mobile: the same sidebar in a drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" showCloseButton={false} className="w-[260px] gap-0 p-0 sm:max-w-[260px]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <BackendBanner />
          {!onMeeting && <Topbar onOpenMenu={() => setMobileOpen(true)} hideTitle={onAsk} searchLeft={onLibrary ? 233 : onAsk ? 227 : collapsed ? 319 : 261} />}
          <ShellProvider value={{ openNav: () => setMobileOpen(true) }}>
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </ShellProvider>
        </div>
      </div>
    </div></AskFredProvider>
  );
}
