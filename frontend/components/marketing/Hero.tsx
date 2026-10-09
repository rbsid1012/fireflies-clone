import Link from "next/link";
import { DemoButton } from "./DemoButton";
import { ArrowRight, CheckCheck, FileText, ListChecks, Play, Search, Sparkles } from "lucide-react";

const SPEAKERS = [
  { name: "Nina", color: "bg-speaker-0", text: "The goal today is to agree the November launch plan: message, channels and owners." },
  { name: "Aisha", color: "bg-speaker-2", text: "SMS depends on a vendor integration. If it slips we shouldn't advertise it." },
  { name: "Priya", color: "bg-speaker-1", text: "I can introduce two beta customers who are happy to be quoted." },
];

/** A drawn, static preview of the meeting page (no screenshots needed, always crisp). */
function ProductPreview() {
  return (
    <div className="relative mx-auto mt-14 max-w-5xl text-left" aria-hidden="true">
      <div className="absolute inset-x-10 -top-10 h-40 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl shadow-black/60">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
          <span className="mx-auto flex items-center gap-2 text-[12px] text-white/50"><FileText className="size-3.5" /> Q4 Launch Campaign Planning</span>
        </div>
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4 border-b border-white/5 p-5 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/40"><Search className="size-3.5" /> Search the transcript</div>
            {SPEAKERS.map((s, i) => (
              <div key={s.name} className={`flex gap-3 rounded-lg p-2 ${i === 1 ? "bg-primary/15 ring-1 ring-primary/40" : ""}`}>
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${s.color} text-[10px] font-semibold text-black/80`}>{s.name[0]}</span>
                <div>
                  <p className="text-[12px] text-white/50">{s.name} <span className="ml-1 tabular-nums">{`0${i + 1}:${String(i * 17 + 5).padStart(2, "0")}`}</span></p>
                  <p className="text-[13px] leading-5 text-white/85">{s.text}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-full bg-white/[0.05] px-3 py-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary"><Play className="size-3.5 fill-white text-white" /></span>
              <div className="h-1 flex-1 rounded-full bg-white/10"><div className="h-1 w-2/5 rounded-full bg-primary" /></div>
              <span className="text-[11px] tabular-nums text-white/40">02:41</span>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-white/40">Overview</p>
              <p className="text-[13px] leading-5 text-white/80">The team agreed the launch plan for November 12: one core message, email and Slack as headline channels, a webinar two weeks later.</p>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-white/40"><ListChecks className="size-3.5" /> Action items</p>
              <ul className="space-y-2 text-[13px]">
                {["Deliver final launch copy to design", "Send introductions to two beta customers", "Book the webinar platform"].map((t, i) => (
                  <li key={t} className="flex items-center gap-2.5 text-white/80">
                    <span className={`grid size-4 place-items-center rounded border ${i === 1 ? "border-primary bg-primary" : "border-white/25"}`}>{i === 1 && <CheckCheck className="size-3 text-white" />}</span>
                    <span className={i === 1 ? "line-through opacity-50" : ""}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="flex items-center gap-2 text-[12px] text-white/50"><Sparkles className="size-3.5 text-[#2dbf9b]" /> Ask Fred</p>
              <p className="mt-1 text-[13px] text-white/85">What risks did we flag? <span className="text-white/50">SMS may slip, about 30%.</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-20 text-center sm:pt-28">
      <div className="mx-auto max-w-3xl">
        <p className="mx-auto mb-5 w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-[13px] text-white/60">Summaries, action items and answers from every meeting</p>
        <h1 className="text-balance text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[60px]">Stop taking notes.<br /><span className="bg-gradient-to-r from-[#c5265f] via-[#9b6bf5] to-[#7f5af0] bg-clip-text text-transparent">Start following up.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-[17px] leading-7 text-white/60">Add a transcript and get a clear summary, an outline, and action items with owners and due dates. Search every conversation, and ask Fred what was decided.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">Get started free <ArrowRight className="size-4" /></Link>
          <DemoButton className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 text-[15px] transition-colors hover:bg-white/5" />
        </div>
        <p className="mt-4 text-[13px] text-white/40">No credit card. The demo needs no sign-up.</p>
      </div>
      <ProductPreview />
    </section>
  );
}
