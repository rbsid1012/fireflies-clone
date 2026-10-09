"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus, Search, Sparkle, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SummaryTemplate = "general" | "one_on_one" | "team" | "standup" | "custom";
export const TEMPLATES: { id: SummaryTemplate; label: string; group: "Default" | "Internal" }[] = [
  { id: "general", label: "General Summary", group: "Default" },
  { id: "one_on_one", label: "1:1", group: "Internal" },
  { id: "team", label: "Team Meeting", group: "Internal" },
  { id: "standup", label: "Standup", group: "Internal" },
];

type Props = {
  label: string;
  busy: boolean;
  onTemplate: (t: SummaryTemplate) => void;
  /** Called with the user's instructions for "Custom Summary" and "Refine Summary" */
  onInstructions: (instructions: string, template: SummaryTemplate) => void;
  notesMarkdown: () => string;
};

/** The row above the notes: pick a summary style, refine it with your own instructions, copy it. */
export function SummaryControls({ label, busy, onTemplate, onInstructions, notesMarkdown }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"custom" | "refine" | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const shown = TEMPLATES.filter((t) => !query.trim() || t.label.toLowerCase().includes(query.trim().toLowerCase()));

  const submit = () => {
    const instructions = text.trim();
    if (!instructions) return;
    onInstructions(instructions, dialog === "custom" ? "custom" : "general");
    setDialog(null); setText("");
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="inline-flex h-8 items-center gap-2 text-iris outline-none hover:text-iris-soft focus-visible:ring-2 focus-visible:ring-ring/50" aria-label="Choose a summary style">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkle className="size-4" strokeWidth={1.5} />} {label}
          <svg aria-hidden="true" viewBox="0 0 16 16" className={cn("size-3.5 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[260px] gap-0 rounded-lg p-0">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg3" strokeWidth={1.5} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search summary styles" className="h-10 w-full bg-transparent pl-9 pr-3 text-[14px] outline-none placeholder:text-fg3" />
          </div>
          <div className="max-h-[260px] overflow-y-auto py-2" role="listbox" aria-label="Summary styles">
            {(["Default", "Internal"] as const).map((g) => {
              const items = shown.filter((t) => t.group === g);
              return items.length === 0 ? null : (
                <div key={g}>
                  <p className="px-3 pb-1 pt-2 text-[12px] text-fg3">{g}</p>
                  {items.map((t) => (
                    <button key={t.id} type="button" role="option" aria-selected={t.label === label} onClick={() => { setOpen(false); onTemplate(t.id); }} className={cn("flex h-9 w-full items-center px-3 text-left text-[14px] transition-colors hover:bg-muted", t.label === label ? "bg-muted text-foreground" : "text-fg2")}>
                      {t.label}{t.label === label && <Check className="ml-auto size-4 text-iris" strokeWidth={1.5} />}
                    </button>
                  ))}
                </div>
              );
            })}
            {shown.length === 0 && <p className="px-3 py-3 text-[13px] text-fg3">No matching style</p>}
          </div>
          <div className="border-t border-border p-2">
            <button type="button" onClick={() => { setOpen(false); setDialog("custom"); }} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-iris-chip text-[14px] text-iris transition-colors hover:bg-iris-chip/70"><Plus className="size-4" strokeWidth={1.5} /> Custom Summary</button>
          </div>
        </PopoverContent>
      </Popover>

      <button type="button" onClick={() => setDialog("refine")} disabled={busy} className="inline-flex h-8 items-center gap-2 text-iris outline-none hover:text-iris-soft disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring/50"><WandSparkles className="size-4" strokeWidth={1.5} /> Refine Summary</button>

      <button
        type="button" aria-label="Copy the notes" title="Copy the notes"
        onClick={async () => { try { await navigator.clipboard.writeText(notesMarkdown()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error("Couldn't copy."); } }}
        className="grid size-8 place-items-center rounded-md text-fg3 transition-colors hover:bg-muted hover:text-foreground"
      >{copied ? <Check className="size-4 text-emerald-400" strokeWidth={1.8} /> : <Copy className="size-4" strokeWidth={1.5} />}</button>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "custom" ? "Custom summary" : "Refine summary"}</DialogTitle>
            <DialogDescription>{dialog === "custom" ? "Say how you want this meeting summarised. The notes are rewritten to follow it." : "Tell Fred what to change, such as “focus on risks” or “shorter, with owners for every task”."}</DialogDescription>
          </DialogHeader>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} aria-label="Instructions for the summary" placeholder={dialog === "custom" ? "e.g. Write it for the sales team: pain points, objections, next steps." : "e.g. Focus on decisions and who owns them."} className="w-full resize-none rounded-md border border-input bg-card p-3 text-[14px] outline-none focus-visible:border-iris" />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="button" size="lg" className="h-9 px-3.5 text-[14px]" disabled={!text.trim()} onClick={submit}>{dialog === "custom" ? "Create summary" : "Refine"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
