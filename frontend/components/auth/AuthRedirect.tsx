"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HOME_PATH } from "@/lib/nav";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuth } from "./AuthProvider";

/** On public pages: if you're already signed in, skip the marketing and go to your home page. */
export function AuthRedirect({ to = HOME_PATH }: { to?: string }) {
  const { status } = useAuth();
  const hydrated = useHydrated();
  const router = useRouter();
  useEffect(() => {
    if (hydrated && status === "authed") router.replace(to);
  }, [hydrated, status, router, to]);
  return null;
}
