import Link from "next/link";
import { DemoButton } from "./DemoButton";
import { ArrowRight, BellRing, Bot, FileText, Lock, ListChecks, Mail, Plug, Search, Sparkles, Upload, type LucideIcon } from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileText, title: "Summaries that read well", body: "An overview, an outline with timestamps, and keywords for every meeting, in the length you prefer." },
  { icon: ListChecks, title: "Action items with owners", body: "Commitments are picked out, assigned to whoever said them, given due dates, and linked to the exact moment." },
  { icon: Search, title: "Search every conversation", body: "Full-text search across all transcripts, with stemming and highlighted snippets that jump to the moment." },
  { icon: Sparkles, title: "Ask Fred", body: "Ask what was decided, who owns what, or what risks came up, for one meeting or your whole library." },
  { icon: Mail, title: "Recap emails", body: "A tidy recap lands in your inbox, or your team's, as soon as a meeting is processed." },
  { icon: Plug, title: "Slack and webhooks", body: "Post summaries to a Slack channel or send signed JSON to Zapier, Make or your own service." },
];

const STEPS = [
  { icon: Upload, title: "Add a meeting", body: "Upload a .txt, .vtt, .srt or .json transcript, or paste one. Attach the audio to play it back in sync." },
  { icon: Bot, title: "We do the reading", body: "Speakers, a summary, chapters and action items are ready in seconds." },
  { icon: BellRing, title: "Follow up", body: "Check off tasks, search later, get the recap by email, and ask Fred anything." },
];

const FAQ = [
  ["Does it transcribe audio?", "Not yet. It works from the transcript you provide (from your recorder, Zoom, Meet, or any captions file). You can attach the recording so playback follows the transcript."],
  ["Do I need an AI key?", "No. Without one, summaries and answers come from built-in analysis of your transcripts. With one configured on the server, summaries and Ask Fred are written by a language model."],
  ["Is my data private?", "Every account is isolated: no one else can see your meetings, people or tags. You can delete any meeting or your whole account at any time."],
  ["What does it cost?", "It's a portfolio project, so it's free."],
  ["Can I try it without signing up?", "Yes. Use the demo account from the login page: it's pre-filled with seven realistic meetings."],
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
      <h2 className="text-center text-[32px] font-semibold tracking-tight sm:text-[40px]">Everything after the meeting, handled</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-white/55">The work that usually falls on one person, done the moment the transcript is in.</p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.04]">
            <div className="mb-4 grid size-10 place-items-center rounded-xl bg-primary/15 text-iris-soft"><Icon className="size-5" strokeWidth={1.6} /></div>
            <h3 className="text-[17px] font-medium">{title}</h3>
            <p className="mt-1.5 text-[14px] leading-6 text-white/55">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-[32px] font-semibold tracking-tight sm:text-[40px]">From transcript to follow-up in three steps</h2>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-2xl border border-white/8 p-6">
              <span className="absolute right-5 top-5 text-[40px] font-semibold leading-none text-white/[0.07]">{i + 1}</span>
              <Icon className="mb-4 size-6 text-iris-soft" strokeWidth={1.5} />
              <h3 className="text-[17px] font-medium">{title}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-white/55">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AskFred() {
  const exchange = [
    ["user", "Who owns the launch copy, and when is it due?"],
    ["fred", "Nina owns it and it's due October 14 [04:12]. Design needs it by the 15th for the hero visual."],
    ["user", "What risks did we flag?"],
    ["fred", "SMS depends on an unfinished vendor integration, about a 30% chance it slips [08:03]. The plan is to lead with email and Slack."],
  ];
  return (
    <section id="ask" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-5 py-20 lg:grid-cols-2">
      <div>
        <p className="mb-3 flex items-center gap-2 text-[13px] font-medium uppercase tracking-wide text-iris-soft"><Sparkles className="size-4" /> Ask Fred</p>
        <h2 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">Ask your meetings anything</h2>
        <p className="mt-4 text-[16px] leading-7 text-white/60">Fred answers from what was actually said, names who said it, and links to the exact moment so you can verify. Ask about one meeting, or everything you&apos;ve ever recorded.</p>
        <ul className="mt-6 space-y-2 text-[15px] text-white/75">
          {["My action items", "Key decisions", "Anything someone said about pricing"].map((t) => (
            <li key={t} className="flex items-center gap-2.5"><ArrowRight className="size-4 text-iris-soft" /> {t}</li>
          ))}
        </ul>
        <p className="mt-6 flex items-center gap-2 text-[13px] text-white/45"><Lock className="size-3.5" /> Only your own meetings are ever searched.</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-background p-5" aria-hidden="true">
        {exchange.map(([who, text], i) => (
          <div key={i} className={who === "user" ? "ml-10 rounded-xl bg-primary/20 px-4 py-2.5 text-[14px]" : "mr-6 rounded-xl bg-white/[0.05] px-4 py-3 text-[14px] leading-6 text-white/85"}>{text}</div>
        ))}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20">
      <h2 className="text-center text-[32px] font-semibold tracking-tight">Questions</h2>
      <div className="mt-10 divide-y divide-white/8 rounded-2xl border border-white/8">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="text-[20px] leading-none text-white/40 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-[15px] leading-7 text-white/60">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1f6b] via-[#3b2a9e] to-[#5a2a8f] p-10 text-center sm:p-14">
        <h2 className="text-[30px] font-semibold tracking-tight sm:text-[38px]">Your next meeting, already written up</h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] text-white/70">Create an account in a few seconds, or look around the demo first.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-[#2a1f6b] transition-colors hover:bg-white/90">Get started free <ArrowRight className="size-4" /></Link>
          <DemoButton className="inline-flex h-12 items-center rounded-xl border border-white/30 px-6 text-[15px] transition-colors hover:bg-white/10" />
        </div>
      </div>
    </section>
  );
}
