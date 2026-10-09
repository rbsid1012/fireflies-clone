"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/useHydrated";
import { safeNext } from "@/lib/form-errors";
import { useAuth } from "./AuthProvider";

/** Auth pages are for signed-out visitors; a signed-in user is sent on to the app. Always dark. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const hydrated = useHydrated();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && status === "authed") router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, [hydrated, status, router]);

  return <div className="dark bg-background text-foreground">{children}</div>;
}
