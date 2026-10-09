"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, Link2, Search, Sparkle, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useActiveSkills } from "@/hooks/useActiveSkills";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import { SKILLS, fromCustom, type Skill } from "@/lib/skills";
import { cn } from "@/lib/utils";

type Tab = "discover" | "active";

function SkillRow({ skill, selected, on, onSelect, onToggle }: { skill: Skill; selected: boolean; on: boolean; onSelect: () => void; onToggle: (v: boolean) => void }) {
  return (
    <div className={cn("flex h-[72px] items-center gap-4 rounded-lg border px-4 transition-colors", selected ? "border-iris bg-card" : "border-border bg-card/60 hover:bg-card")}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className={cn("grid size-[38px] shrink-0 place-items-center rounded-md text-white", skill.tile)}><skill.icon className="size-5" strokeWidth={1.8} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] text-foreground">{skill.title}</span>
          <span className="block truncate text-[13px] text-fg3">Built in</span>
        </span>
      </button>
      <button
        type="button" role="switch" aria-checked={on} aria-label={`${skill.title} ${on ? "on" : "off"}`} onClick={() => onToggle(!on)}
        className={cn("relative h-[18px] w-8 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-input")}
      ><span className={cn("absolute top-[2px] size-3.5 rounded-full transition-all", on ? "left-[16px] bg-white" : "left-[2px] bg-[#d1d1d6]")} /></button>
    </div>
  );
}

/** Master/detail layout from the reference: skills on the left (509px column), the selected one on the right. */
export function AiSkillsPage() {
  const [tab, setTab] = useState<Tab>("discover");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(SKILLS[0].id);
  const [active, toggle] = useActiveSkills();
  const custom = useCustomSkills();
  const everything = [...custom.skills.map(fromCustom), ...SKILLS];

  const q = query.trim().toLowerCase();
  const pool = tab === "active" ? everything.filter((s) => active.includes(s.id)) : everything;
  const list = pool.filter((s) => !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  const selected = everything.find((s) => s.id === selectedId) ?? everything[0];
  const isOn = active.includes(selected.id);
  const groups = (["Yours", "Recommended", "Popular"] as const).map((g) => ({ g, items: list.filter((s) => s.group === g) })).filter((x) => x.items.length);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-[51px] shrink-0 items-center justify-center gap-3 bg-muted px-4 text-[14px] text-foreground">
        <Sparkle className="size-4 shrink-0" strokeWidth={1.8} />
        <span><span className="text-foreground">Meet AI Skills</span> — one-click prompts that run across your meetings, with sources you can click.</span>
      </div>

      <div role="tablist" aria-label="AI Skills" className="flex gap-6 border-b border-border px-[38px]">
        {([["discover", "Discover"], ["active", `Active Skills (${active.length})`]] as const).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("-mb-px border-b-2 px-3 py-3.5 text-[14px] outline-none transition-colors", tab === v ? "border-iris text-iris" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
        <span role="tab" aria-selected="false" aria-disabled="true" title="A feed of skill outputs isn't part of this version" className="-mb-px cursor-not-allowed border-b-2 border-transparent px-3 py-3.5 text-[14px] text-fg4">Feed</span>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[509px_1fr]">
        <div className="space-y-3 border-r border-border px-[38px] py-[22px]">
          <div className="flex gap-2">
            <div className="flex h-9 flex-1 items-center gap-2.5 rounded-md border border-border bg-card px-3 text-[14px] text-fg2"><Zap className="size-4 text-muted-foreground" strokeWidth={1.5} /> All Skills <ChevronDown className="ml-auto size-4 text-muted-foreground" strokeWidth={1.5} /></div>
            <button type="button" aria-label="Search skills" aria-pressed={searching} onClick={() => setSearching((s) => !s)} className="grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"><Search className="size-4" strokeWidth={1.5} /></button>
          </div>
          {searching && <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" aria-label="Search skills" className="h-9 w-full rounded-md border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-iris" />}

          {groups.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-fg3">{tab === "active" ? "You haven't turned any skills on yet." : "No skills match."}</p>
          ) : groups.map(({ g, items }) => (
            <section key={g} aria-label={g} className="space-y-3">
              <h2 className="pt-3 text-[14px] text-fg3">{g}</h2>
              {items.map((s) => <SkillRow key={s.id} skill={s} selected={s.id === selected.id} on={active.includes(s.id)} onSelect={() => setSelectedId(s.id)} onToggle={(v) => toggle(s.id, v)} />)}
            </section>
          ))}
        </div>

        <div className="px-[30px] py-[22px] lg:pr-10">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="bg-gradient-to-b from-[#3a2a12]/70 to-transparent p-6">
              <div className="flex items-start justify-between">
                <span className={cn("grid size-[38px] place-items-center rounded-md text-white", selected.tile)}><selected.icon className="size-5" strokeWidth={1.8} /></span>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(selected.prompt); toast.success("Prompt copied"); } catch { toast.error("Couldn't copy."); } }} className="inline-flex items-center gap-2 text-[14px] text-muted-foreground hover:text-foreground"><Link2 className="size-4" strokeWidth={1.5} /> Copy prompt</button>
              </div>
              <h2 className="mt-4 text-[18px] font-normal text-foreground">{selected.title}</h2>
              <p className="mt-2 text-[14px] text-fg2">{selected.description}</p>
              <p className="mt-3 text-[13px] leading-5 text-fg3"><Copy className="mr-1.5 inline size-3.5" />Prompt: {selected.prompt}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => toggle(selected.id, !isOn)} className={cn("h-9 rounded-md px-4 text-[14px] transition-colors", isOn ? "border border-input text-foreground hover:bg-muted" : "bg-primary text-white hover:bg-primary/90")}>{isOn ? "Turn off" : "Enable"}</button>
                <Link href={`/askfred?q=${encodeURIComponent(selected.prompt)}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-iris-chip px-4 text-[14px] text-iris-soft transition-colors hover:bg-iris-chip/70"><Sparkles className="size-4" strokeWidth={1.5} /> Try Skill</Link>
              </div>
              {selected.group === "Yours" && (
                <button type="button" onClick={() => { custom.remove(selected.id); toggle(selected.id, false); toast.success("Skill deleted"); }} className="mt-4 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-destructive">Delete this skill</button>
              )}
              <p className="mt-4 text-[13px] text-fg3">Enabled skills appear on every meeting&apos;s AI Skills tab so you can run them in one click.</p>
            </div>
          </div>

          <Link href="/integrations" className="mt-12 flex items-center justify-between rounded-xl border border-border bg-card/60 px-5 py-4 text-[14px] transition-colors hover:bg-card">
            <span><span className="text-foreground">Get insights on Slack</span> <span className="text-muted-foreground">— Post meeting recaps to your Slack channel.</span></span>
            <span className="text-iris">Connect →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
