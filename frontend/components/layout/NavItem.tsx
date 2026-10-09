"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActive, type NavItemConfig } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Props = { item: NavItemConfig; collapsed: boolean; onNavigate?: () => void };

/** 32px row: 16px outline icon, 14px label. Collapsed, it is a 40px-wide icon button. */
export function NavItem({ item, collapsed, onNavigate }: Props) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-3 text-[14px] leading-none text-muted-foreground outline-none transition-colors",
        "hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "bg-muted text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-4 shrink-0", item.iconClass)} {...(item.colorIcon ? {} : { strokeWidth: 1.5 })} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-[4px] bg-success px-2 py-1 text-[12px] font-medium leading-none text-success-foreground">{item.badge}</span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
