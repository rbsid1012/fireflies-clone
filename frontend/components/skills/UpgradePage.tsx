import Link from "next/link";
import { Check, Minus } from "lucide-react";

const INCLUDED = [
  "Unlimited meetings, transcripts and search",
  "Summaries, chapters and action items for every meeting",
  "AskFred across all your meetings, with clickable sources",
  "Audio and video playback synced to the transcript",
  "Recap emails, Slack and signed webhooks",
  "Personal API keys and Swagger docs",
  "Light and dark themes",
];
const NOT_INCLUDED = [
  "Live recording, meeting bots and calendar auto-join",
  "Speech-to-text (you bring the transcript)",
  "Teams and shared workspaces",
  "Voice Agents, Email Assistant and the MCP server",
];

export function UpgradePage() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-10 md:px-8">
      <h1 className="text-[26px] font-medium">There&apos;s nothing to upgrade</h1>
      <p className="mt-2 text-[15px] leading-7 text-muted-foreground">This app has no paid plans, meeting limits or billing. Everything below is already available to you.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-[16px] font-medium">Included</h2>
          <ul className="mt-4 space-y-3">
            {INCLUDED.map((t) => <li key={t} className="flex gap-3 text-[14px] leading-6"><Check className="mt-1 size-4 shrink-0 text-emerald-400" /> {t}</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-[16px] font-medium">Not part of this version</h2>
          <ul className="mt-4 space-y-3">
            {NOT_INCLUDED.map((t) => <li key={t} className="flex gap-3 text-[14px] leading-6 text-muted-foreground"><Minus className="mt-1 size-4 shrink-0" /> {t}</li>)}
          </ul>
        </section>
      </div>
      <Link href="/home" className="mt-8 inline-flex h-10 items-center rounded-lg border px-4 text-[14px] transition-colors hover:bg-accent">Back to home</Link>
    </div>
  );
}
