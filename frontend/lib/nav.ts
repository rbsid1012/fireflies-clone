import {
  Bot, ChartNoAxesColumn, Home, Layers, ListCheck, Settings, Sparkle, Video, Zap, type LucideIcon,
} from "lucide-react";
import { FredIcon } from "@/components/layout/icons";

export type NavItemConfig = {
  label: string;
  href: string;
  icon: LucideIcon | typeof FredIcon;
  /** Small pill after the label */
  badge?: string;
  /** Tint for the icon */
  iconClass?: string;
  /** Icon ships with its own colours; don't apply stroke styling */
  colorIcon?: boolean;
};

export { HOME_PATH } from "./routes";

export const PRIMARY_NAV: NavItemConfig[][] = [
  [
    { label: "Home", href: "/home", icon: Home },
    { label: "AskFred", href: "/askfred", icon: FredIcon, colorIcon: true },
  ],
  [
    { label: "Meetings", href: "/meetings", icon: Video },
    { label: "Tasks", href: "/tasks", icon: ListCheck },
    { label: "AI Skills", href: "/ai-skills", icon: Sparkle },
  ],
  [
    { label: "Analytics", href: "/analytics", icon: ChartNoAxesColumn },
    { label: "Voice Agents", href: "/voice-agents", icon: Bot },
  ],
  [{ label: "Upgrade", href: "/upgrade", icon: Zap, badge: "ALL FREE" }],
];

export const FOOTER_NAV: NavItemConfig[] = [
  { label: "Integrations", href: "/integrations", icon: Layers },
  { label: "Settings", href: "/settings", icon: Settings },
];

const TITLES: Record<string, string> = {
  home: "Home",
  askfred: "AskFred",
  meetings: "Meetings",
  upload: "Uploads",
  search: "Search",
  tasks: "Tasks",
  "ai-skills": "AI Skills",
  analytics: "Analytics",
  "voice-agents": "Voice Agents",
  upgrade: "Upgrade",
  integrations: "Integrations",
  settings: "Settings",
};

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Title for the top bar, from the first URL segment. */
export function pageTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return TITLES[segment] ?? "Fireflies Clone";
}
