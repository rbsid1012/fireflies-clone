import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="prose-page mx-auto max-w-2xl px-5 py-16 text-[15px] leading-7 text-foreground/85">
      <h1 className="mb-2 text-[32px] font-medium tracking-tight text-foreground">Terms of use</h1>
      <p className="mb-8 text-muted-foreground">This is a demonstration application built as a portfolio project.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">Use of the service</h2>
      <p>You may use this app to store transcripts you have the right to keep and to generate summaries from them. Don&apos;t upload content you aren&apos;t allowed to share, and don&apos;t use the service to harm others or to attack it.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">No warranty</h2>
      <p>The service is provided as is, without guarantees of availability or accuracy. Summaries and action items are generated automatically and can be wrong: check them before relying on them.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">Your data</h2>
      <p>You can delete any meeting, and your whole account, from the app at any time. Deleted data is removed from the database.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">Changes</h2>
      <p>These terms may change as the project evolves.</p>
    </article>
  );
}
