import Link from "next/link";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { Wordmark } from "@/components/auth/BrandMark";
import { GuestOnly } from "@/components/auth/GuestOnly";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestOnly>
      <div className="grid min-h-dvh bg-[#121213] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <main className="flex flex-col px-6 py-8 sm:px-12 lg:px-20">
          <Link href="/" aria-label="Home" className="w-fit"><Wordmark /></Link>
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
        </main>
        <AuthShowcase />
      </div>
    </GuestOnly>
  );
}
