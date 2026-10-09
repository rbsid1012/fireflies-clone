"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { Integration } from "@/lib/types";
import { CATALOG } from "./catalog";
import { IntegrationDialog } from "./IntegrationDialog";

const ICONS = Object.fromEntries(CATALOG.map((c) => [c.id, c.icon]));

function Connected({ item, onDelete }: { item: Integration; onDelete: () => void }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.patch<Integration>(`/api/integrations/${item.id}`, { enabled }),
    onSuccess: refresh,
    onError: () => toast.error("Couldn't update the integration."),
  });
  const test = useMutation({
    mutationFn: () => api.post<{ result: string }>(`/api/integrations/${item.id}/test`),
    onSuccess: (r) => { refresh(); toast.message(r.result); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "The test failed."),
  });
  const Icon = ICONS[item.kind] ?? ICONS.webhook;
  const failing = item.last_status && !/^ok|^2\d\d/i.test(item.last_status);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-5" strokeWidth={1.6} /></span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-[15px] font-medium">{item.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {item.url_host}
          {item.last_run_at && <> · last sent {formatMeetingDateTime(item.last_run_at)}{item.last_status && <span className={failing ? "text-destructive" : undefined}> ({item.last_status})</span>}</>}
        </p>
      </div>
      <Button variant="outline" size="lg" className="h-9 gap-2 px-3 text-[14px]" onClick={() => test.mutate()} disabled={test.isPending}>
        {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send test
      </Button>
      <Switch checked={item.enabled} onCheckedChange={(v) => toggle.mutate(v)} aria-label={`${item.name} enabled`} disabled={toggle.isPending} />
      <button type="button" onClick={onDelete} aria-label={`Delete ${item.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"><Trash2 className="size-4" /></button>
    </li>
  );
}

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<"slack" | "webhook" | null>(null);
  const [deleting, setDeleting] = useState<Integration | null>(null);
  const list = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<Integration[]>("/api/integrations") });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); setDeleting(null); toast.success("Integration removed"); },
    onError: () => toast.error("Couldn't remove the integration."),
  });

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-[22px] font-medium">Integrations</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Send meeting recaps to the tools your team already uses.</p>
      </header>

      <section aria-labelledby="connected-h" className="space-y-3">
        <h2 id="connected-h" className="text-[15px] font-medium">Connected</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {list.isPending ? <Skeleton className="m-5 h-12" /> : list.data?.length ? (
            <ul className="divide-y">{list.data.map((i) => <Connected key={i.id} item={i} onDelete={() => setDeleting(i)} />)}</ul>
          ) : (
            <p className="px-5 py-6 text-[14px] text-muted-foreground">Nothing connected yet. Pick Slack or Webhook below.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="catalog-h" className="space-y-3">
        <h2 id="catalog-h" className="text-[15px] font-medium">All integrations</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-muted"><c.icon className="size-5" strokeWidth={1.6} /></span>
                <p className="text-[15px] font-medium">{c.name}</p>
              </div>
              <p className="flex-1 text-[14px] leading-6 text-muted-foreground">{c.description}</p>
              {c.kind ? (
                <Button variant="outline" size="lg" className="h-9 w-fit px-3.5 text-[14px]" onClick={() => setAdding(c.kind!)}>Connect</Button>
              ) : (
                <span className="w-fit rounded-md bg-muted px-2 py-1 text-[12px] text-muted-foreground">Coming soon</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {adding && <IntegrationDialog kind={adding} onClose={() => setAdding(null)} />}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Remove this integration?" confirmLabel="Remove" pending={remove.isPending}
        description={<>“{deleting?.name}” will stop receiving meetings.</>} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
