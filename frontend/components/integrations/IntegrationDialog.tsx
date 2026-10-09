"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { Integration } from "@/lib/types";

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

const COPY = {
  slack: { title: "Connect Slack", hint: "Paste an incoming webhook URL from your Slack app (it starts with https://hooks.slack.com/).", placeholder: "https://hooks.slack.com/services/…", defaultName: "Slack" },
  webhook: { title: "Add a webhook", hint: "We POST a JSON payload to this HTTPS address. Each request is signed so you can verify it came from here.", placeholder: "https://example.com/hooks/meetings", defaultName: "Webhook" },
} as const;

/** Create flow. For webhooks, the signing secret is shown once the integration exists. */
export function IntegrationDialog({ kind, onClose }: { kind: "slack" | "webhook"; onClose: () => void }) {
  const qc = useQueryClient();
  const copy = COPY[kind];
  const [name, setName] = useState<string>(copy.defaultName);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api.post<Integration>("/api/integrations", { kind, name, url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const created = create.data;
  const error = create.error instanceof ApiError ? create.error.message.replace(/^url: /, "") : create.error ? "Couldn't save the integration." : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {!created ? (
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.hint}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="int-name" className="text-[13px] text-muted-foreground">Name</label>
              <input id="int-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="int-url" className="text-[13px] text-muted-foreground">{kind === "slack" ? "Webhook URL" : "Endpoint URL"}</label>
              <input id="int-url" className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={copy.placeholder} inputMode="url" autoComplete="off" autoFocus />
            </div>
            {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="lg" className="h-9 gap-2 px-3.5 text-[14px]" disabled={create.isPending || !name.trim() || url.trim().length < 8}>
                {create.isPending && <Loader2 className="size-4 animate-spin" />} Connect
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{created.name} is connected</DialogTitle>
              <DialogDescription>
                {created.secret ? "Use this secret to verify the X-Signature header (HMAC-SHA256 of the request body). It stays available on this page." : "New meetings will be posted to your channel. Use Send test on the card to check it."}
              </DialogDescription>
            </DialogHeader>
            {created.secret && (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border bg-background p-2.5 font-mono text-[13px]">{created.secret}</code>
                <button
                  type="button" aria-label="Copy the signing secret"
                  onClick={async () => { try { await navigator.clipboard.writeText(created.secret!); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.error("Couldn't copy. Select the text and copy it by hand."); } }}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border transition-colors hover:bg-accent"
                >
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </div>
            )}
            <DialogFooter><Button size="lg" className="h-9 px-3.5 text-[14px]" onClick={onClose}>Done</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
