import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 text-[15px] leading-7 text-foreground/85">
      <h1 className="mb-2 text-[32px] font-medium tracking-tight text-foreground">Privacy</h1>
      <p className="mb-8 text-muted-foreground">What this demonstration app stores, and why.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">What we store</h2>
      <p>Your account (name, email, a salted password hash), the meetings you add (transcripts, summaries, action items, and any audio you attach), and your settings.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">In your browser</h2>
      <p>Your login token and theme preference are kept in your browser&apos;s local storage. There are no analytics, advertising or tracking cookies.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">Third parties</h2>
      <p>If the server has an AI provider configured, meeting text is sent to it to write summaries and answer questions. If you connect Slack or a webhook, summaries are sent to the address you provide. Recap emails go through the email provider configured on the server.</p>
      <h2 className="mb-2 mt-8 text-[18px] font-medium text-foreground">Deleting your data</h2>
      <p>Delete a meeting from its page, or delete your whole account under Settings, Account. Both remove the data immediately.</p>
    </article>
  );
}
