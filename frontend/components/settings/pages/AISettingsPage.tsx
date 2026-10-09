"use client";

import { useState } from "react";
import { ListChecks, ScrollText, Wand2 } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { Group, Row, SettingsPage } from "../primitives";

function Instructions({ initial }: { initial: string }) {
  const { save, saving } = useSaveSettings();
  const [text, setText] = useState(initial);
  const dirty = text.trim() !== initial;
  return (
    <div className="space-y-2">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} aria-label="Custom instructions"
        placeholder="For example: Keep it short. Always note budget impact. Refer to customers by company name."
        className="w-full resize-y rounded-lg border border-input bg-background p-3 text-[14px] leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span>{text.length}/1000</span>
        <button type="button" disabled={!dirty || saving} onClick={() => save({ ai: { custom_instructions: text.trim() } })}
          className="rounded-lg bg-primary px-3.5 py-1.5 text-[14px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}

export function AISettingsPage() {
  const { data } = useSettings();
  const { save } = useSaveSettings();
  if (!data) return <SettingsPage title="AI Settings"><Skeleton className="h-64 w-full" /></SettingsPage>;
  const ai = data.ai;
  return (
    <SettingsPage title="AI Settings" description="How new summaries are written. Changes apply to meetings you add or regenerate from now on.">
      <Group title="Summaries">
        <Row icon={ScrollText} title="Summary length" description="How much detail the overview and outline go into.">
          <NativeSelect aria-label="Summary length" value={ai.summary_style} onChange={(e) => save({ ai: { summary_style: e.target.value as typeof ai.summary_style } })} className="w-[170px]">
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </NativeSelect>
        </Row>
        <Row icon={ListChecks} title="Pick out action items" description="Find commitments and requests, with owners and due dates.">
          <Switch checked={ai.extract_action_items} onCheckedChange={(v) => save({ ai: { extract_action_items: v } })} aria-label="Pick out action items" />
        </Row>
        <Row icon={Wand2} title="Custom instructions" description="Standing guidance for AI-written summaries and for Ask Fred. Ignored when no AI model is configured on the server." stacked>
          <Instructions key={ai.custom_instructions} initial={ai.custom_instructions} />
        </Row>
      </Group>
    </SettingsPage>
  );
}
