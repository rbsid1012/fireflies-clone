"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { SecurityOverview } from "@/lib/types";
import { Group, SettingsPage } from "../primitives";

const FIX: Record<string, { href: string; label: string }> = {
  sign_in: { href: "/settings/account", label: "Set a password" },
  retention: { href: "/settings/recording-privacy", label: "Choose a retention period" },
  api_keys: { href: "/settings/api", label: "Review API keys" },
};

export function SecurityPage() {
  const { data } = useQuery({ queryKey: ["security"], queryFn: () => api.get<SecurityOverview>("/api/settings/security") });
  return (
    <SettingsPage title="Security overview" description="A short checklist for keeping your account and data tidy.">
      {!data ? <Skeleton className="h-48 w-full" /> : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
            <div className="grid size-14 place-items-center rounded-full text-[15px] font-medium tabular-nums" style={{ background: `conic-gradient(var(--primary) ${(data.done / data.total) * 360}deg, var(--muted) 0)` }}>
              <span className="grid size-11 place-items-center rounded-full bg-card">{data.done}/{data.total}</span>
            </div>
            <p className="text-[15px]">{data.done === data.total ? "Everything looks good." : `${data.total - data.done} thing${data.total - data.done === 1 ? "" : "s"} you could improve.`}</p>
          </div>
          <Group title="Checklist">
            {data.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-3.5 px-5 py-4">
                {c.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />}
                <div className="min-w-0 flex-1"><p className="text-[15px]">{c.label}</p><p className="mt-0.5 text-[14px] text-muted-foreground">{c.detail}</p></div>
                {!c.done && FIX[c.id] && <Link href={FIX[c.id].href} className="shrink-0 text-[14px] underline underline-offset-4 hover:text-foreground">{FIX[c.id].label}</Link>}
              </div>
            ))}
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
