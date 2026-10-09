"use client";

import { useState } from "react";
import { Headphones, MessageCircle, Mic as MicIcon, Phone, Play, Plus, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

const AGENTS = [
  { name: "Screening Interview Agent", text: "Hire faster with automatic screening calls that assess candidate skills.", tint: "bg-[#b24fa3]" },
  { name: "Discovery Call Agent", text: "Qualify prospects with focused discovery calls that uncover needs and buying signals.", tint: "bg-[#1fb0b0]" },
  { name: "Customer Feedback Agent", text: "Collect structured feedback from customers without scheduling a call.", tint: "bg-[#7c5cf0]" },
  { name: "Support Follow-up Agent", text: "Check in after a ticket closes and capture how it went.", tint: "bg-[#e58a3a]" },
];

/** Layout of the reference's Voice Agents page: tab bar, full-bleed hero, banner, setup row, agent cards. Voice agents need telephony and live speech, which this app doesn't have, so everything is a preview. */
export function VoiceAgentsPage() {
  const { user } = useAuth();
  const first = user?.name.split(" ")[0]?.toUpperCase();
  const [tab, setTab] = useState<"discover" | "mine">("discover");
  const [cloneBannerGone, setCloneBannerGone] = useState(false);
  return (
    <div>
      <div role="tablist" aria-label="Voice Agents" className="flex h-12 justify-center border-b border-border">
        {([["discover", "Discover"], ["mine", "My Voice Agents"]] as const).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("relative w-[163px] text-[14px] outline-none transition-colors", tab === v ? "text-iris after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[#7f73e8]" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {tab === "discover" ? (
        <>
          <section className="relative h-[234px] overflow-hidden bg-gradient-to-b from-[#575c70] via-[#566572] to-[#3c474f]">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_105%,rgba(0,0,0,0.65),transparent_60%)]" />
            <div className="relative mx-auto flex h-full w-full max-w-[994px] items-start justify-between px-4 pt-[30px] lg:px-0">
              <div className="max-w-[380px]">
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-medium leading-[28px] text-foreground">Experience Voice Agents</h1>
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-black/20 px-2.5 text-[12px] text-fg2">Preview only</span>
                </div>
                <p className="mt-3 text-[14px] leading-[22px] text-fg2">Voice Agents handle your calls, ask the right questions, and deliver clear insights. This app has no phone calling, so these are examples.</p>
                <div className="mt-5 flex gap-3">
                  <button type="button" disabled className="inline-flex h-[34px] cursor-not-allowed items-center gap-2 rounded-md bg-[#6338e6]/80 px-3.5 text-[14px] text-white"><Headphones className="size-4" strokeWidth={1.5} /> Try It Live</button>
                  <button type="button" disabled className="inline-flex h-[34px] cursor-not-allowed items-center gap-2 rounded-md bg-sidebar/80 px-3.5 text-[14px] text-fg2 shadow-lg"><Play className="size-4 fill-current" strokeWidth={1.5} /> Watch Demo</button>
                </div>
              </div>
              <div aria-hidden="true" className="relative mt-[-30px] hidden h-[156px] w-[244px] shrink-0 rounded-b-2xl border border-t-0 border-[#5a3dd8] bg-gradient-to-b from-[#1a0b4d] to-[#0a0424] md:block">
                <span className="absolute -left-[187px] top-[52px] whitespace-nowrap rounded-xl border border-[#6a63d6]/60 bg-[#313170] px-4 py-2 text-[14px] text-foreground shadow-lg">How do you handle tight deadlines?</span>
                <span className="absolute left-1/2 top-[30px] grid size-[90px] -translate-x-1/2 place-items-center rounded-full border-[3px] border-[#7b4bff] bg-gradient-to-br from-[#3a1a99] to-[#12063a] shadow-[0_0_40px_#6d3bff88]"><Headphones className="size-8 text-white" strokeWidth={1.4} /></span>
                <span className="absolute -bottom-9 left-1/2 flex h-[26px] w-[90px] -translate-x-1/2 items-center justify-center gap-3 rounded-full bg-black/60"><MicIcon className="size-3.5 text-white" strokeWidth={1.5} /><span className="h-[18px] w-9 rounded-full bg-[#b3382c]" /></span>
                <span className="absolute bottom-2.5 left-3 text-[12px] text-foreground">Acme&apos;s Voice Agent</span>
              </div>
            </div>
            <div aria-hidden="true" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2"><span className="size-1.5 rounded-full bg-[#7f73e8]" /><span className="size-1.5 rounded-full bg-[#5c6277]" /></div>
          </section>

          <div className="mx-auto w-full max-w-[994px] px-4 pb-16 lg:px-0">
            {!cloneBannerGone && (
              <div className="mt-12 flex h-12 items-center gap-3 rounded-lg bg-muted px-5 text-[14px] text-fg2">
                <MicIcon className="size-[18px] shrink-0 text-[#8ab4ff]" strokeWidth={1.5} />
                <p className="flex-1"><span className="text-foreground">Try Voice Cloning</span> — Make your agent sound exactly like you in 30 seconds.</p>
                <span className="text-iris">Not available</span>
                <button type="button" aria-label="Dismiss" onClick={() => setCloneBannerGone(true)} className="ml-3 grid size-6 place-items-center text-muted-foreground hover:text-foreground"><X className="size-4" strokeWidth={1.5} /></button>
              </div>
            )}
            <div className="mt-8 flex items-start justify-between">
              <div>
                <h2 className="text-[18px] leading-7 text-foreground">{first ? `${first}, set` : "Set"} up your Voice Agent in 2 minutes</h2>
                <p className="mt-3 inline-flex items-center gap-2 text-[14px] text-muted-foreground"><MessageCircle className="size-4" strokeWidth={1.5} /> Share Feedback</p>
              </div>
              <button type="button" disabled className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-md bg-[#623ae6]/60 px-4 text-[14px] text-white/80"><Plus className="size-4" strokeWidth={1.5} /> Custom Agent</button>
            </div>
            <ul className="mt-9 grid gap-[17px] md:grid-cols-2">
              {AGENTS.map((a) => (
                <li key={a.name} className="rounded-lg border border-border bg-surface p-[25px]">
                  <span className={cn("grid size-12 place-items-center rounded-lg", a.tint)}><Phone className="size-6 text-white" strokeWidth={1.6} /></span>
                  <p className="mt-5 text-[14px] text-foreground">{a.name}</p>
                  <p className="mt-2 text-[14px] leading-[22px] text-muted-foreground">{a.text}</p>
                  <span className="mt-4 inline-flex h-8 items-center rounded-md border border-input px-3 text-[13px] text-fg3">Not available</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="mx-auto mt-10 w-full max-w-[994px] rounded-2xl border border-dashed border-input p-12 text-center text-[14px] text-muted-foreground">You haven&apos;t created any voice agents.</div>
      )}
    </div>
  );
}
