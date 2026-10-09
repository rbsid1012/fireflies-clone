"use client";

import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { useActiveSkills } from "@/hooks/useActiveSkills";
import { runInAskFred } from "@/lib/ask-events";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import { SKILLS, fromCustom } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** The AI Skills you turned on, ready to run on this meeting. Output appears in Ask Fred on the right. */
export function SkillsTab({ meetingId, onRun }: { meetingId: number; onRun?: () => void }) {
  const [active] = useActiveSkills();
  const custom = useCustomSkills().skills;
  const skills = [...custom.map(fromCustom), ...SKILLS].filter((s) => active.includes(s.id));
  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Sparkles} title="No AI Skills turned on" description="Turn on the skills you use most and they will be waiting here for every meeting."
        action={<Link href="/ai-skills" className={cn(buttonVariants({ size: "lg" }), "h-9 px-3.5 text-[14px]")}>Browse AI Skills</Link>}
      />
    );
  }
  return (
    <ul className="space-y-3">
      {skills.map((s) => (
        <li key={s.id} className="flex items-center gap-4 rounded-2xl border bg-card/60 p-4">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-white", s.tile)}><s.icon className="size-5" strokeWidth={1.7} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{s.title}</span>
            <span className="block text-[13px] text-muted-foreground">{s.description}</span>
          </span>
          <button type="button" onClick={() => { runInAskFred(meetingId, s.prompt); onRun?.(); }} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[14px] transition-colors hover:bg-accent"><Play className="size-3.5" /> Run</button>
        </li>
      ))}
    </ul>
  );
}
