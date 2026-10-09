"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Search, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserTile } from "@/components/layout/UserTile";
import { api } from "@/lib/api";
import type { SecurityOverview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TeamFyiDialog } from "./pages/TeamPages";
import { SETTINGS_FOOTER, SETTINGS_GROUPS, TEAM_GROUPS, type SettingsLink } from "./nav";

function NavLink({ link, active, badge }: { link: SettingsLink; active: boolean; badge?: React.ReactNode }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href} aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-3 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.5} />
      <span className="truncate">{link.label}</span>
      {badge}
    </Link>
  );
}

/** Settings is its own screen (no app sidebar or top bar): a 247px navigation column, then the content. */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [filter, setFilter] = useState("");
  const security = useQuery({ queryKey: ["security"], queryFn: () => api.get<SecurityOverview>("/api/settings/security"), staleTime: 30_000 });
  const team = pathname.startsWith("/settings/team");

  const q = filter.trim().toLowerCase();
  const match = (l: SettingsLink) => !q || l.label.toLowerCase().includes(q);
  const groups = (team ? TEAM_GROUPS : SETTINGS_GROUPS).map((g) => g.filter(match)).filter((g) => g.length);

  const mobileLinks = [...(team ? TEAM_GROUPS : SETTINGS_GROUPS).flat(), ...SETTINGS_FOOTER];
  const current = mobileLinks.find((l) => pathname === l.href) ?? mobileLinks.find((l) => pathname.startsWith(l.href));

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Phones: one select instead of the navigation column */}
      <div className="flex items-center gap-2 border-b border-border p-3 md:hidden">
        <Link href="/home" aria-label="Back to the app" className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" strokeWidth={1.5} /></Link>
        <label className="sr-only" htmlFor="settings-section">Settings section</label>
        <div className="relative flex-1">
          <select
            id="settings-section" value={current?.href ?? ""} onChange={(e) => { window.location.assign(e.target.value); }}
            className="h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-[14px]"
          >
            {mobileLinks.map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <aside className="hidden h-full w-[247px] shrink-0 flex-col border-r border-border bg-sidebar md:flex" aria-label="Settings navigation">
        <div className="px-4 pt-4">
          <Link href="/home" aria-label="Back to the app" className="grid size-8 place-items-center rounded-md text-fg2 hover:bg-muted"><ArrowLeft className="size-4" strokeWidth={1.5} /></Link>
        </div>
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-3">
          <UserTile name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] leading-4 text-foreground">{user?.email}</p>
            <p className="mt-1 text-[12px] leading-4 text-fg3">{user?.is_demo ? "Demo account" : "Free Plan"}</p>
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <div className="mx-3 mb-4 flex rounded-md bg-muted p-[3px] text-[14px]" role="tablist" aria-label="Scope">
          <Link role="tab" aria-selected={!team} href="/settings/recording-privacy" className={cn("flex-1 rounded-[5px] py-[5px] text-center", !team ? "bg-seg text-foreground" : "text-muted-foreground")}>Personal</Link>
          <Link role="tab" aria-selected={team} href="/settings/team/recording-privacy" className={cn("flex-1 rounded-[5px] py-[5px] text-center", team ? "bg-seg text-foreground" : "text-muted-foreground")}>Team</Link>
        </div>

        <nav className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-3 pb-3">
          {groups.map((group, i) => (
            <div key={i} className="space-y-0.5">
              {group.map((l) => <NavLink key={l.href} link={l} active={pathname.startsWith(l.href)} />)}
            </div>
          ))}
          {groups.length === 0 && <p className="px-3 py-3 text-[13px] text-fg3">No settings match “{filter}”.</p>}
        </nav>

        <div className="space-y-1 px-3 pb-3">
          <NavLink link={{ ...SETTINGS_FOOTER[0], icon: UserRound }} active={pathname.startsWith(SETTINGS_FOOTER[0].href)} />
          <Link
            href="/settings/security" aria-current={pathname.startsWith("/settings/security") ? "page" : undefined}
            className={cn("flex h-9 items-center gap-2.5 rounded-md border border-border px-3 text-[14px] transition-colors", pathname.startsWith("/settings/security") ? "bg-muted text-foreground" : "text-fg2 hover:bg-muted/60")}
          >
            <ShieldCheck className="size-4 text-muted-foreground" strokeWidth={1.5} /> Security overview
            {security.data && <span className="ml-auto rounded bg-iris-chip px-1.5 text-[12px] leading-5 tabular-nums text-iris-soft">{security.data.done}/{security.data.total}</span>}
          </Link>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto hidden w-full max-w-[694px] px-4 pt-4 md:block">
          <div className="relative mx-auto w-[318px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg3" strokeWidth={1.5} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search settings" aria-label="Search settings" className="h-[34px] w-full rounded-lg border border-input bg-card pl-9 pr-3 text-[14px] outline-none placeholder:text-fg3 focus-visible:border-iris" />
          </div>
        </div>
        {children}
      </div>
      {team && <TeamFyiDialog key={pathname.startsWith("/settings/team") ? "team" : "personal"} />}
    </div>
  );
}
