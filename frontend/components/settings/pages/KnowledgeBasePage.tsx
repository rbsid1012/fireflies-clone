"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { Group, SettingsPage } from "../primitives";

function Editor({ initial }: { initial: string }) {
  const { save, saving } = useSaveSettings();
  const [text, setText] = useState(initial);
  const dirty = text !== initial;
  return (
    <div className="space-y-3 p-5">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} rows={14} aria-label="Knowledge base notes"
        placeholder={"Lumenly sells shipment-tracking software to freight forwarders.\nOur main competitors are A and B.\nInternal terms: “the freeze” means the release freeze on Thursdays."}
        className="w-full resize-y rounded-xl border border-input bg-background p-3.5 text-[14px] leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{text.length.toLocaleString()} / 20,000 characters{dirty && " · unsaved changes"}</span>
        <div className="flex gap-2">
          <button type="button" disabled={!dirty} onClick={() => setText(initial)} className="rounded-lg border px-3.5 py-1.5 text-[14px] transition-colors hover:bg-accent disabled:opacity-50">Discard</button>
          <button type="button" disabled={!dirty || saving} onClick={() => save({ knowledge_base: { notes: text } })} className="rounded-lg bg-primary px-3.5 py-1.5 text-[14px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeBasePage() {
  const { data } = useSettings();
  return (
    <SettingsPage title="Knowledge Base" description="Background Ask Fred should know: your products, customers, jargon, who is who. It is added to every question when an AI model is configured.">
      <Group title="Notes">
        {data ? <Editor key={data.knowledge_base.notes} initial={data.knowledge_base.notes} /> : <div className="p-5"><Skeleton className="h-72 w-full" /></div>}
      </Group>
      <p className="text-[13px] leading-6 text-muted-foreground">Sent to the AI as reference material, and it is told not to follow instructions found in it. Don&apos;t put secrets here.</p>
    </SettingsPage>
  );
}
