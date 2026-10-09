import Link from "next/link";
import { Wordmark } from "@/components/auth/BrandMark";
import { AuthRedirect } from "@/components/auth/AuthRedirect";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#ask", label: "Ask Fred" },
  { href: "/#faq", label: "FAQ" },
];

/** Header and footer shared by the public pages. Signed-in visitors are sent straight to the app. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-[#0f0f10] text-foreground">
      <AuthRedirect />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0f0f10]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Link href="/" aria-label="Home"><Wordmark /></Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="transition-colors hover:text-foreground">{n.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">Get started free</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row">
          <Wordmark className="text-[15px]" />
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
          </div>
          <p>A portfolio project. Not affiliated with any meeting-notes company.</p>
        </div>
      </footer>
    </div>
  );
}
