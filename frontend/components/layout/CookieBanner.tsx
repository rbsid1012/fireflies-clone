"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const KEY = "ff_cookie_notice";
const subscribe = () => () => {};
const seen = () => { try { return window.localStorage.getItem(KEY) === "1"; } catch { return true; } };

/** A one-time notice. This app sets no tracking cookies; it only stores what it needs in your browser. */
export function CookieBanner() {
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (alreadySeen || dismissed) return null;
  return (
    <div role="region" aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-popover p-4 text-[13px] shadow-xl sm:left-6 sm:right-auto">
      <p className="leading-5 text-foreground/90">
        We only store what&apos;s needed to keep you signed in and remember your theme. No analytics or advertising cookies.{" "}
        <Link href="/privacy" className="underline underline-offset-2">Details</Link>
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="lg" className="h-8 px-3 text-[13px]" onClick={() => { try { window.localStorage.setItem(KEY, "1"); } catch {} setDismissed(true); }}>Got it</Button>
      </div>
    </div>
  );
}
