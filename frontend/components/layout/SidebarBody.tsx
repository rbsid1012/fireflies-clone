"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Laptop, PanelLeftClose, PanelLeftOpen, UserPlus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";
import { FOOTER_NAV, PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { MailMark } from "./icons";
import { NavItem } from "./NavItem";
import { ProfileMenu } from "./ProfileMenu";
import { UserTile } from "./UserTile";

type Props = {
  collapsed: boolean;
  /** The rail is collapsed because the page needs the room (not by choice): the avatar keeps opening the account panel */
  forced?: boolean;
  /** Omit to hide the collapse control (the mobile drawer is always expanded). */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
};

const SLIDES = [
  { id: "team", icon: null, text: "Invite coworkers to your Fireflies team", cta: "Create Team", href: "/settings/team" },
  { id: "botless", icon: Laptop, text: "Bot-less meetings: add any recording or transcript", cta: "Add a meeting", href: "/upload" },
] as const;

/** The two-slide card at the bottom of the sidebar: swaps on its own, pauses on hover, dots jump to a slide. */
function SidebarCarousel({ onNavigate }: { onNavigate?: () => void }) {
  const [dismissed, setDismissed] = usePersistentFlag("invite-card-dismissed");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || dismissed) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 8000);
    return () => clearInterval(t);
  }, [paused, dismissed]);
  if (dismissed) return null;
  const slide = SLIDES[index];
  const Icon = slide.icon;
  return (
    <div className="px-4 pb-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative h-[150px] rounded-xl border border-border px-3 pt-3">
        {Icon && <Icon className="absolute left-[18px] top-[17px] size-5 text-foreground" strokeWidth={1.5} />}
        <button
          type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}
          className="absolute right-[15px] top-[14px] grid size-4 place-items-center text-fg4 hover:text-foreground"
        ><X className="size-4" strokeWidth={1.3} /></button>
        <p key={slide.id} className="absolute inset-x-[13px] top-[49px] text-[14px] leading-5 text-foreground">{slide.text}</p>
        <Link
          href={slide.href} onClick={onNavigate}
          className="absolute inset-x-[13px] top-[104px] flex h-8 items-center justify-center rounded-[4px] bg-primary text-[14px] text-white transition-colors hover:bg-primary/90"
        >{slide.cta}</Link>
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {SLIDES.map((sl, i) => (
          <button key={sl.id} type="button" aria-label={`Show slide ${i + 1} of ${SLIDES.length}`} aria-current={i === index} onClick={() => setIndex(i)}
            className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-fg3" : "bg-fg4/50")} />
        ))}
      </div>
    </div>
  );
}

export function SidebarBody({ collapsed, forced, onToggleCollapsed, onNavigate }: Props) {
  const { user } = useAuth();
  const name = user?.name;
  const swapAvatar = collapsed && !forced && !!onToggleCollapsed;
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  const toggle = onToggleCollapsed && (
    <Tooltip>
      <TooltipTrigger
        onClick={onToggleCollapsed}
        aria-label={toggleLabel}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Toggle className="size-4" strokeWidth={1.5} />
      </TooltipTrigger>
      <TooltipContent side="right">{toggleLabel}</TooltipContent>
    </Tooltip>
  );

  return (
    <nav aria-label="Main" className="group/side flex h-full w-full flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "gap-1 pl-[10px] pr-2")}>
        {swapAvatar ? (
          <div className="group/avatar relative grid size-8 place-items-center">
            <span className="pointer-events-none transition-opacity group-hover/avatar:opacity-0 group-focus-within/avatar:opacity-0"><UserTile name={name} /></span>
            <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100 [&>button]:size-8 [&>button]:rounded-md [&>button]:bg-muted">{toggle}</span>
          </div>
        ) : (
          <ProfileMenu collapsed={collapsed} />
        )}
        {!collapsed && <span className="opacity-0 transition-opacity group-hover/side:opacity-100 focus-within:opacity-100">{toggle}</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {PRIMARY_NAV.map((group, i) => (
          <div key={i} className={cn("flex flex-col gap-[1.5px] px-2 py-2", i > 0 && "relative mt-0 border-t border-border", i > 0 && !collapsed && "mx-0")}>
            {group.map((item) => (
              <NavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </div>

      {!collapsed && (
        <Link
          href="/settings/email-assistant" onClick={onNavigate}
          className="mx-3 mb-[17px] flex h-8 shrink-0 items-center gap-2 rounded-[4px] bg-banner px-3 text-[14px] text-foreground transition-colors hover:bg-banner/70"
        >
          <MailMark className="size-4" /> Try Email Assistant
        </Link>
      )}

      <div className={cn("flex shrink-0 flex-col gap-0.5 px-2", collapsed ? "pb-2" : "pb-[7px]")}>
        {collapsed && <NavItem item={{ label: "Invite your team", href: "/settings/team", icon: UserPlus }} collapsed onNavigate={onNavigate} />}
        {FOOTER_NAV.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      {!collapsed && <SidebarCarousel onNavigate={onNavigate} />}
    </nav>
  );
}
