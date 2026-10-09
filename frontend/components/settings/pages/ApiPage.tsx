"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, KeyRound, Loader2, Plus, Server, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, api, ApiError } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { ApiKey, ApiKeyCreated } from "@/lib/types";
import { Group, Row, SettingsPage } from "../primitives";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" aria-label={label}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { toast.error("Couldn't copy. Select the text and copy it by hand."); } }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors hover:bg-accent"
    >
      {done ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} {done ? "Copied" : "Copy"}
    </button>
  );
}

function CreateKey({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<ApiKeyCreated>("/api/api-keys", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
  const key = create.data?.key;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {!key ? (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>Give it a name that says where it will be used.</DialogDescription>
            </DialogHeader>
            <input aria-label="Key name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Zapier, my script"
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
            {create.error && <p role="alert" className="text-[13px] text-destructive">{create.error instanceof ApiError ? create.error.message : "Couldn't create the key."}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="lg" className="h-9 gap-2 px-3.5 text-[14px]" disabled={!name.trim() || create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create key</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>This is the only time it is shown. Store it somewhere safe; if you lose it, create a new one.</DialogDescription>
            </DialogHeader>
            <code className="block break-all rounded-lg border bg-background p-3 font-mono text-[13px]" data-testid="new-api-key">{key}</code>
            <DialogFooter>
              <CopyButton text={key} label="Copy the API key" />
              <Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApiKey | null>(null);
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => api.get<ApiKey[]>("/api/api-keys") });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); qc.invalidateQueries({ queryKey: ["security"] }); setDeleting(null); toast.success("Key deleted. It no longer works."); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete the key."),
  });
  const example = `curl ${API_URL}/api/meetings \\\n  -H "Authorization: Bearer ffk_your_key_here"`;

  return (
    <SettingsPage title="MCP & API" description="Use your meetings from your own scripts and tools.">
      <Group title="API keys">
        <Row icon={KeyRound} title="Personal API keys" description="A key can do everything you can, so treat it like a password. Revoke any you no longer use.">
          <Button size="lg" className="h-9 gap-2 px-3.5 text-[14px]" onClick={() => setCreating(true)}><Plus className="size-4" /> Create key</Button>
        </Row>
        <div className="px-5 py-3">
          {keys.isPending ? <Skeleton className="h-12 w-full" /> : keys.data?.length === 0 ? (
            <p className="py-2 text-[14px] text-muted-foreground">No keys yet.</p>
          ) : (
            <ul className="divide-y">
              {keys.data?.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{k.name}</p>
                    <p className="text-[12px] text-muted-foreground"><code>{k.prefix}…</code> · created {formatMeetingDateTime(k.created_at)} · {k.last_used_at ? `last used ${formatMeetingDateTime(k.last_used_at)}` : "never used"}</p>
                  </div>
                  <button type="button" onClick={() => setDeleting(k)} aria-label={`Delete key ${k.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Group>

      <Group title="Using the API">
        <div className="space-y-3 p-5">
          <p className="text-[14px] text-muted-foreground">Send the key as a bearer token. Everything the app does is available: meetings, transcripts, search, action items, Ask Fred.</p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-xl border bg-background p-4 font-mono text-[13px] leading-6">{example}</pre>
            <div className="absolute right-2 top-2"><CopyButton text={example} label="Copy the example" /></div>
          </div>
          <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[14px] underline underline-offset-4 hover:text-foreground">Interactive API documentation <ExternalLink className="size-3.5" /></a>
        </div>
      </Group>

      <Group title="MCP">
        <Row icon={Server} title="MCP server" description="Let AI assistants such as Claude read your meetings through the Model Context Protocol." badge="Coming soon" disabled />
      </Group>

      {creating && <CreateKey onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this API key?" confirmLabel="Delete key" pending={remove.isPending}
        description={<>Anything using “{deleting?.name}” will stop working straight away.</>} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </SettingsPage>
  );
}
