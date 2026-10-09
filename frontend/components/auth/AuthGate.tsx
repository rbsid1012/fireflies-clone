"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuth } from "./AuthProvider";
import { BrandMark } from "./BrandMark";

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark className="size-9 animate-pulse" />
        {children}
      </div>
    </div>
  );
}

/** Only signed-in users see what's inside; everyone else is sent to the login page. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && status === "anon") {
      const next = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [hydrated, status, pathname, router]);

  if (hydrated && status === "authed") return <>{children}</>;
  if (hydrated && status === "error") {
    return (
      <Splash>
        <WifiOff className="size-5 text-muted-foreground" />
        <p className="max-w-xs text-[14px] text-muted-foreground">Can&apos;t reach the server. It may be waking up; give it a moment.</p>
        <Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={retry}>Try again</Button>
      </Splash>
    );
  }
  return <Splash />;
}
