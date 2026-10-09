import {
  BookOpen, Bell, Code2, IdCard, Lock, Mail, Radio, Shield, SlidersHorizontal, Users, Video, Wand2, Workflow, type LucideIcon,
} from "lucide-react";

export type SettingsLink = { href: string; label: string; icon: LucideIcon };

/** Grouped like the reference's settings navigation. */
export const SETTINGS_GROUPS: SettingsLink[][] = [
  [
    { href: "/settings/appearance", label: "Language & Appearance", icon: SlidersHorizontal },
    { href: "/settings/recording-privacy", label: "Recording & Privacy", icon: Video },
    { href: "/settings/compliance", label: "Compliance Notification", icon: Bell },
  ],
  [{ href: "/settings/email-assistant", label: "Email Assistant", icon: Mail }],
  [
    { href: "/settings/ai", label: "AI Settings", icon: Wand2 },
    { href: "/settings/live-assist", label: "Live Assist", icon: Radio },
    { href: "/settings/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  ],
  [{ href: "/settings/api", label: "MCP & API", icon: Code2 }],
  [{ href: "/settings/cookies", label: "Cookies", icon: Lock }],
];

export const SETTINGS_FOOTER: SettingsLink[] = [
  { href: "/settings/account", label: "Account", icon: IdCard },
  { href: "/settings/security", label: "Security overview", icon: Shield },
];

/** Workspace ("Team") settings. Teams are not part of this app, so these hold defaults for when teammates exist. */
export const TEAM_GROUPS: SettingsLink[][] = [
  [
    { href: "/settings/team/recording-privacy", label: "Recording & Privacy", icon: Video },
    { href: "/settings/team/compliance", label: "Compliance Notification", icon: Bell },
  ],
  [
    { href: "/settings/team/ai", label: "AI Settings", icon: Wand2 },
    { href: "/settings/team/live-meeting", label: "Live Meeting", icon: Radio },
  ],
  [{ href: "/settings/team/rules", label: "Rules", icon: Workflow }],
  [{ href: "/settings/team/members", label: "Teammates and groups", icon: Users }],
];
