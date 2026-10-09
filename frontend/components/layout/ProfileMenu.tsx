"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Code2, Layers, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMeetingCount } from "@/hooks/useMe";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { API_URL, api } from "@/lib/api";
import { applyTheme, type ThemePreference } from "@/lib/theme";
import type { Analytics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserTile } from "./UserTile";

const THEMES: ThemePreference[] = ["dark", "light", "system"];
const THEME_LABEL: Record<ThemePreference, string> = { dark: "Dark", light: "Light", system: "System" };

const row = "flex h-8 w-full items-center justify-between rounded-md px-4 text-left text-[14px] text-fg2 outline-none transition-colors hover:bg-muted focus-visible:bg-muted";

function Bar({ value, className, thick }: { value: number; className?: string; thick?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-accent", thick ? "h-[3px]" : "h-[2px]")} role="presentation">
      <div className={cn("h-full rounded-full bg-[#4a8a5c]", className)} style={{ width: `${Math.max(1, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

function Card({ icon: Icon, title, text, href, cta, onNavigate }: { icon: typeof Code2; title: string; text: string; href: string; cta: string; onNavigate: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Icon className="size-5 text-iris-soft" strokeWidth={1.5} />
      <p className="mt-3 text-[14px] text-foreground">{title}</p>
      <p className="mt-1.5 text-[14px] leading-[22px] text-muted-foreground">{text}</p>
      <Link href={href} onClick={onNavigate} className="mt-3 inline-flex h-8 items-center rounded-md border border-input px-3 text-[14px] text-fg2 transition-colors hover:bg-muted">{cta}</Link>
    </div>
  );
}

/** Profile trigger at the top of the sidebar; opens the two-column account panel from the reference. */
export function ProfileMenu({ collapsed, placement }: { collapsed: boolean; placement?: { side: "bottom" | "right"; align: "start" | "end" } }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const count = useMeetingCount();
  const settings = useSettings();
  const { save } = useSaveSettings();
  const analytics = useQuery({ queryKey: ["analytics", "totals"], queryFn: () => api.get<Analytics>("/api/analytics"), enabled: open, staleTime: 60_000 });

  const name = user?.name;
  const theme = settings.data?.appearance.theme ?? "dark";
  const minutes = Math.round((analytics.data?.totals.total_duration_ms ?? 0) / 60_000);
  const nextTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    applyTheme(next);
    save({ appearance: { theme: next } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Account menu"
        openOnHover
        delay={120}
        closeDelay={220}
        className={cn(
          "flex h-8 min-w-0 items-center gap-2.5 rounded-md text-[15px] outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          collapsed ? "mx-auto w-8 justify-center" : "flex-1 px-2 hover:bg-muted/50",
        )}
      >
        <UserTile name={name} />
        {!collapsed && (
          <>
            <span className="truncate uppercase text-fg2">{name?.split(" ")[0] ?? "Account"}</span>
            <ChevronDown className="size-3 shrink-0 text-fg2" strokeWidth={1.8} />
          </>
        )}
      </PopoverTrigger>

      <PopoverContent align={placement?.align ?? "start"} side={placement?.side ?? (collapsed ? "right" : "bottom")} sideOffset={8} className="max-h-[calc(100dvh-5rem)] w-[min(94vw,582px)] gap-0 overflow-y-auto rounded-xl border border-border bg-surface p-2">
        <div className="grid gap-2 md:grid-cols-[259px_1fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-3.5">
              <p className="truncate text-[16px] text-foreground">Hi {name?.split(" ")[0]?.toUpperCase() ?? "there"}</p>
              <p className="mt-0.5 truncate text-[13px] text-fg3">{user?.email}</p>
            </div>
            <div className="space-y-3 border-b border-border px-4 py-4">
              <p className="text-[14px] text-foreground">{user?.is_demo ? "Demo plan" : "Free"}</p>
              <Bar value={1} thick />
              <p className="text-[13px] text-fg3">{count.data ?? "–"} meetings · no limits</p>
              <Link href="/upgrade" onClick={close} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-success-foreground/30 bg-success text-[14px] text-success-foreground transition-opacity hover:opacity-90"><Zap className="size-4 fill-current" strokeWidth={1.5} /> Upgrade</Link>
            </div>
            <div className="space-y-3 border-b border-border px-4 py-4">
              <p className="text-[14px] text-foreground">Storage</p>
              <Bar value={Math.min(1, minutes / 400)} className="bg-[#2f6b45]" />
              <p className="text-[13px] text-fg3">{minutes} / 400 mins</p>
            </div>
            <div className="py-2">
              <button type="button" disabled className={cn(row, "cursor-not-allowed text-fg4 hover:bg-transparent")}>Playlist <span className="text-[11px]">Coming soon</span></button>
              <Link href="/settings" onClick={close} className={row}>Settings</Link>
              <Link href="/settings/team" onClick={close} className={row}>My Team</Link>
              <Link href="/settings/account" onClick={close} className={row}>Manage Web Logins</Link>
              <Link href="/settings/recording-privacy" onClick={close} className={row}>Platform Rules</Link>
              <button type="button" onClick={nextTheme} className={row} aria-label={`Theme: ${THEME_LABEL[theme]}. Click to change.`}>
                <span className="flex items-center gap-2">Theme <span className="rounded bg-iris-chip px-1.5 py-0.5 text-[11px] text-iris-soft">BETA</span></span>
                <span className="text-[14px] text-fg3">{THEME_LABEL[theme]}</span>
              </button>
              <button type="button" onClick={() => { close(); signOut(); }} className={row}>Logout</button>
            </div>
          </div>

          <div className="space-y-2">
            <Card icon={Code2} title="API & MCP" text="Use your meetings from scripts and tools with a personal API key." href="/settings/api" cta="Get a key" onNavigate={close} />
            <Card icon={Layers} title="Integrations" text="Send meeting recaps to Slack or any webhook." href="/integrations" cta="Connect" onNavigate={close} />
            <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" className="flex h-[54px] items-center justify-between rounded-lg border border-iris/30 bg-iris-chip px-4 text-[14px] text-foreground transition-colors hover:bg-iris-chip/70">
              Open the API documentation <ArrowRight className="size-4" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
