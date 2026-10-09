"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, Globe, Link2, Lock, Mail, MessageSquare, MonitorSmartphone, Plus, Search, Sparkle, Trash2, Type, Video, VideoOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserTile } from "@/components/layout/UserTile";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import type { UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Group, SettingsPage } from "../primitives";

type Field = keyof UserSettings["team"];
type Policy = "choose" | "on" | "off";
type RowDef = { field: Field; icon: LucideIcon; title: string; description: string; labels?: [string, string, string] };

const DEFAULT_LABELS: [string, string, string] = ["Allow teammates to choose", "Enable for all teammates", "Disable for all teammates"];

const select = "h-10 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-[14px] text-foreground outline-none transition-colors focus-visible:border-iris";

function Notice() {
  return (
    <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px] leading-5 text-fg3">
      Teams aren&apos;t part of this version yet. These workspace defaults are saved with your account and will apply to teammates once you can invite them. Nothing here changes your own settings.
    </p>
  );
}

function PolicyRow({ def, value, onChange }: { def: RowDef; value: Policy; onChange: (v: Policy) => void }) {
  const labels = def.labels ?? DEFAULT_LABELS;
  const options: [Policy, string][] = [["choose", labels[0]], ["on", labels[1]], ["off", labels[2]]];
  const id = `team-${def.field}`;
  return (
    <div className="px-6 py-5">
      <div className="flex gap-3">
        <def.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-[14px] text-foreground">{def.title}</label>
          <p className="mt-0.5 text-[13px] leading-5 text-fg3">{def.description}</p>
          <div className="relative mt-3.5">
            <select id={id} value={value} onChange={(e) => onChange(e.target.value as Policy)} className={select}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

type Section = { title: string; rows: RowDef[] };

function PolicyPage({ title, sections }: { title: string; sections: Section[] }) {
  const settings = useSettings();
  const { save } = useSaveSettings();
  return (
    <SettingsPage title={title}>
      <Notice />
      {settings.isPending ? <Skeleton className="h-64 w-full" /> : sections.map((s) => (
        <Group key={s.title} title={s.title}>
          {s.rows.map((r) => (
            <PolicyRow key={r.field} def={r} value={(settings.data?.team[r.field] ?? "choose") as Policy} onChange={(v) => save({ team: { [r.field]: v } })} />
          ))}
        </Group>
      ))}
    </SettingsPage>
  );
}

export function TeamRecordingPage() {
  return (
    <PolicyPage title="Recording & Privacy (workspace)" sections={[
      { title: "Recording", rows: [
        { field: "auto_record", icon: Calendar, title: "Auto-record meetings", description: "Which workspace members' calendar events get recorded automatically." },
        { field: "capture_video", icon: Video, title: "Capture meeting video", description: "Capture your meeting screen and shared content as video." },
        { field: "meeting_language", icon: Type, title: "Meeting language", description: "Set the default language for transcripts and summaries across the workspace." },
        { field: "auto_delete", icon: Trash2, title: "Auto-delete meetings", description: "Automatically delete workspace members' meetings after the set retention period." },
      ] },
      { title: "Privacy & Access", rows: [
        { field: "meeting_privacy", icon: Lock, title: "Meeting privacy", description: "Defaults apply to all new meetings." },
        { field: "public_access", icon: Globe, title: "Public meeting access", description: "Allow anyone to view workspace members' public meetings without logging in." },
      ] },
      { title: "Email Notification", rows: [
        { field: "recap_email", icon: Mail, title: "Meeting recap email", description: "Send a recap email to selected recipients after each meeting for workspace members." },
      ] },
      { title: "Recording Rules", rows: [
        { field: "record_rules", icon: VideoOff, title: "Record and restriction rules", description: "Whether workspace members' meetings are recorded or skipped when the meeting title mentions certain keywords, emails or domains." },
      ] },
    ]} />
  );
}

export function TeamCompliancePage() {
  return (
    <PolicyPage title="Compliance Notification (workspace)" sections={[
      { title: "Compliance Notification", rows: [
        { field: "notify_email", icon: Mail, title: "Notify participants via email", description: "Tell all participants before a meeting that it will be recorded." },
        { field: "chat_notification", icon: MessageSquare, title: "Meeting chat notification", description: "Send a message in the meeting chat to let attendees know the meeting is being recorded." },
      ] },
    ]} />
  );
}

export function TeamAIPage() {
  return (
    <PolicyPage title="AI Settings (workspace)" sections={[
      { title: "AI Skills", rows: [
        { field: "ai_skills_create", icon: Sparkle, title: "Who can create AI Skills in the workspace", description: "AI Skills can be created by selected people in the workspace.", labels: ["Allow teammates to create AI Skills", "Enable for all teammates", "Only admins can create AI Skills"] },
        { field: "ai_skills_access", icon: Lock, title: "Who can access AI Skills in the workspace", description: "Choose who can customize and use AI Skills created in the workspace." },
      ] },
      { title: "Personal Assistant", rows: [
        { field: "personal_assistant", icon: Sparkle, title: "Who can access personal assistant in the workspace", description: "Choose who can view output from personal assistant." },
      ] },
    ]} />
  );
}

export function TeamLivePage() {
  return (
    <PolicyPage title="Live Meeting (workspace)" sections={[
      { title: "Real-Time Pane Notification", rows: [
        { field: "realtime_pane", icon: Mail, title: "Real-time pane notification", description: "Real-time pane link shared via email to participants for meetings in the workspace." },
        { field: "key_takeaways", icon: MessageSquare, title: "Send key takeaways on meeting chat", description: "For workspace meetings, action items will be sent in the meeting chat shortly before the call ends." },
      ] },
      { title: "Talk to Fireflies", rows: [
        { field: "talk_to_fred", icon: MonitorSmartphone, title: "Interact with Fireflies", description: "Workspace members can interact with Fred through chat or voice to ask questions and get instant answers." },
      ] },
    ]} />
  );
}

/** Rules automate routing after each meeting. There is nothing to route to here, so the page says so. */
export function TeamRulesPage() {
  return (
    <SettingsPage title="Rules">
      <div className="flex flex-col items-center pt-10 text-center">
        <div aria-hidden="true" className="relative h-[220px] w-[480px] max-w-full rounded-3xl bg-card">
          <div className="absolute left-[170px] top-[34px] h-[86px] w-[240px] rounded-lg border border-border bg-background p-3">
            <div className="flex gap-1.5"><span className="h-3 w-12 rounded bg-muted" /><span className="h-3 w-[72px] rounded bg-[#7d2748]" /><span className="h-3 w-10 rounded bg-muted" /></div>
            <span className="mt-2 block h-3 w-[150px] rounded bg-muted" />
          </div>
          <div className="absolute left-[170px] top-[130px] h-[78px] w-[240px] rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-[#2c2570] text-[#a99bff]"><Sparkle className="size-4 fill-current" /></span><span className="text-[12px] text-fg3">Share with…</span></div>
          </div>
          <span className="absolute left-[34px] top-[66px] -rotate-3 rounded bg-[#10334f] px-2.5 py-1 text-[14px] text-[#69b6ff]">Add to #sales</span>
          <span className="absolute left-[262px] top-[112px] rotate-2 rounded bg-[#0f3a3d] px-2.5 py-1 text-[14px] text-[#5fe0e8]">Share with @design-team</span>
        </div>
        <h2 className="mt-10 text-[18px] text-foreground">Automate what happens after every meeting</h2>
        <p className="mt-3 max-w-[470px] text-[14px] leading-6 text-muted-foreground">Rules would route meetings to channels, share them with the right teams, or apply privacy settings based on meeting details. That needs teammates, which this version doesn&apos;t have.</p>
        <button type="button" disabled className="mt-8 inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md bg-primary/50 px-5 text-[14px] text-white/80">Rules aren&apos;t available yet</button>
        <Link href="/integrations" className="mt-3 inline-flex h-10 w-[326px] max-w-full items-center justify-center rounded-md border border-border text-[14px] text-foreground transition-colors hover:bg-muted/60">Send recaps with Integrations instead</Link>
      </div>
    </SettingsPage>
  );
}

type Tab = "members" | "groups" | "advanced";

/** One teammate: you, as the workspace admin. Invites need real teams, so the button explains that. */
export function TeamMembersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("members");
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const me = user && (!query.trim() || `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())) ? user : null;
  return (
    <div className="mx-auto w-full max-w-[694px] px-4 pb-16 pt-9 md:px-0">
      <h1 className="sr-only">Teammates and groups</h1>
      <div role="tablist" aria-label="Teammates and groups" className="inline-flex overflow-hidden rounded-md border border-border text-[14px]">
        {([["members", "1 Teammate"], ["groups", "0 User Groups"], ["advanced", "Advanced Settings"]] as const).map(([v, label], i) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("h-[34px] px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", i > 0 && "border-l border-border", tab === v ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>{label}</button>
        ))}
      </div>

      {tab === "members" && (
        <>
          <div className="mt-5 flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg3" strokeWidth={1.5} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teammates" aria-label="Search teammates" className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[14px] outline-none placeholder:text-fg3 focus-visible:border-iris" />
            </div>
            <div className="flex overflow-hidden rounded-md">
              <button type="button" onClick={() => setInviting(true)} className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-[14px] text-white transition-colors hover:bg-primary/90"><Plus className="size-4" strokeWidth={1.5} /> Invite Teammate</button>
              <button type="button" aria-label="Copy invite link" onClick={() => setInviting(true)} className="grid h-9 w-10 place-items-center border-l border-white/20 bg-primary text-white transition-colors hover:bg-primary/90"><Link2 className="size-4" strokeWidth={1.5} /></button>
            </div>
          </div>
          <p className="mt-6 text-[14px] text-muted-foreground">All teammates (1)</p>
          <div className="mt-4">
            {me ? (
              <div className="flex items-center gap-3 py-2">
                <UserTile name={me.name} className="size-8 rounded-md text-[14px]" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] text-foreground"><span className="truncate uppercase">{me.name}</span><span className="rounded bg-[#0f3a3d] px-1.5 py-0.5 text-[11px] leading-none text-[#5fe0e8]">ADMIN</span></p>
                  <p className="text-[13px] text-fg3">{me.email}</p>
                </div>
              </div>
            ) : <p className="py-4 text-[14px] text-fg3">No teammates match “{query}”.</p>}
          </div>
        </>
      )}
      {tab === "groups" && <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-[14px] text-muted-foreground">You haven&apos;t created any user groups. Groups need more than one teammate.</p>}
      {tab === "advanced" && (
        <div className="mt-6 space-y-3 text-[14px] text-muted-foreground">
          <p>Workspace-wide defaults live under <Link href="/settings/team/recording-privacy" className="text-iris underline-offset-4 hover:underline">Recording &amp; Privacy</Link>, <Link href="/settings/team/compliance" className="text-iris underline-offset-4 hover:underline">Compliance</Link> and <Link href="/settings/team/ai" className="text-iris underline-offset-4 hover:underline">AI Settings</Link>.</p>
        </div>
      )}

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviting teammates isn&apos;t available yet</DialogTitle>
            <DialogDescription>Every account here is personal: your meetings, people and tags are private to you. Sharing a workspace is on the roadmap, and the defaults you set under Team will apply then.</DialogDescription>
          </DialogHeader>
          <DialogFooter><button type="button" onClick={() => setInviting(false)} className="h-9 rounded-md bg-primary px-4 text-[14px] text-white hover:bg-primary/90">Got it</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "You're editing Teams settings": shown once per browser session when you switch to Team. */
export function TeamFyiDialog() {
  const [open, setOpen] = useState(() => { try { return window.sessionStorage.getItem("ff_team_fyi") !== "1"; } catch { return true; } });
  const close = () => { try { window.sessionStorage.setItem("ff_team_fyi", "1"); } catch { /* shown again next time */ } setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[min(94vw,520px)] gap-5 rounded-xl p-6 sm:max-w-[520px]" showCloseButton>
        <DialogHeader><DialogTitle className="text-[16px] font-normal">FYI: You&apos;re editing Teams settings</DialogTitle></DialogHeader>
        <div aria-hidden="true" className="flex h-[155px] flex-col items-center justify-center gap-4 rounded-lg bg-[#10102a]">
          <div className="inline-flex rounded-md bg-[#18183a] p-1 text-[14px]"><span className="px-5 py-1.5 text-muted-foreground">My Account</span><span className="rounded bg-[#1c1c1d] px-5 py-1.5 text-foreground">Teams</span></div>
          <Users3 />
        </div>
        <DialogDescription className="text-[14px] leading-6">Anything you change here applies to everyone on your team. To manage your personal settings, switch to My Account.</DialogDescription>
        <DialogFooter className="-mx-6 -mb-6 border-0 bg-transparent px-6 pb-6 pt-0"><button type="button" onClick={close} className="h-9 rounded-md bg-primary px-5 text-[14px] text-white transition-colors hover:bg-primary/90">Got it</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Users3() {
  return (
    <svg viewBox="0 0 56 44" className="h-11 w-14" fill="none" aria-hidden="true">
      <circle cx="28" cy="15" r="8" fill="#b9aaf6" />
      <path d="M12 38c1.5-7 7-11 16-11s14.500 4 16 11" stroke="#b9aaf6" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 20a8 8 0 0 1 5-7M46 20a8 8 0 0 0-5-7" stroke="#b9aaf6" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
