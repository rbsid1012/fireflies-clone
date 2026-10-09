"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Eye, Info, Loader2, Mail, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthConfig } from "@/hooks/useAuthConfig";
import { api, ApiError } from "@/lib/api";
import { formatMeetingDateTime } from "@/lib/dates";
import type { EmailLog, EmailLogDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Group, Row } from "../primitives";

const STATUS: Record<string, { label: string; className: string; icon: typeof Mail }> = {
  sent: { label: "Sent", className: "text-emerald-400", icon: CheckCircle2 },
  logged: { label: "Logged only", className: "text-amber-400", icon: Info },
  failed: { label: "Failed", className: "text-destructive", icon: TriangleAlert },
};

function Preview({ id, onClose }: { id: number; onClose: () => void }) {
  const mail = useQuery({ queryKey: ["email", id], queryFn: () => api.get<EmailLogDetail>(`/api/emails/${id}`) });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-3 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mail.data?.subject ?? "Email"}</DialogTitle>
          <DialogDescription>{mail.data ? `To ${mail.data.to_email}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        {mail.isPending ? <Skeleton className="h-[480px] w-full" /> : mail.data && (
          // sandbox with no permissions: the email's HTML can't run scripts or navigate this page
          <iframe title="Email preview" sandbox="" srcDoc={mail.data.html} className="h-[480px] w-full rounded-lg bg-white" />
        )}
        {mail.data?.error && <p className="text-[13px] text-destructive">Delivery error: {mail.data.error}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** What the app emailed you, and a button to send a test message through the configured provider. */
export function EmailOutbox() {
  const qc = useQueryClient();
  const config = useAuthConfig();
  const [preview, setPreview] = useState<number | null>(null);
  const emails = useQuery({ queryKey: ["emails"], queryFn: () => api.get<EmailLog[]>("/api/emails", { limit: 8 }) });
  const test = useMutation({
    mutationFn: () => api.post<EmailLog>("/api/settings/email/test"),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      if (row.status === "failed") toast.error(`Couldn't send: ${row.error ?? "unknown error"}`);
      else if (row.status === "logged") toast.info("Recorded in the outbox below. Add SMTP or Resend settings on the server to deliver real email.");
      else toast.success("Test email sent. Check your inbox.");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't send a test email."),
  });
  const transport = config.data?.email_transport;

  return (
    <Group title="Email delivery" id="outbox">
      <Row
        icon={Mail} title="Test your email setup"
        description={transport === "log"
          ? "No email provider is configured on this server, so messages are recorded below instead of delivered."
          : `Emails are delivered through ${transport === "smtp" ? "SMTP" : "Resend"}.`}
      >
        <Button variant="outline" size="lg" className="h-9 gap-2 px-3.5 text-[14px]" onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send a test email
        </Button>
      </Row>
      <div className="px-5 py-3">
        <p className="mb-2 text-[13px] text-muted-foreground">Recent emails</p>
        {emails.isPending ? <Skeleton className="h-16 w-full" /> : emails.data?.length === 0 ? (
          <p className="py-2 text-[14px] text-muted-foreground">Nothing yet. A recap is sent whenever a meeting is added.</p>
        ) : (
          <ul className="divide-y">
            {emails.data?.map((m) => {
              const s = STATUS[m.status] ?? STATUS.logged;
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <s.icon className={cn("size-4 shrink-0", s.className)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{m.subject}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{m.to_email} · {formatMeetingDateTime(m.created_at)} · <span className={s.className}>{s.label}</span></p>
                  </div>
                  <button type="button" onClick={() => setPreview(m.id)} aria-label={`Preview "${m.subject}"`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Eye className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {preview !== null && <Preview id={preview} onClose={() => setPreview(null)} />}
    </Group>
  );
}
