"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { TagPill } from "./TagPill";
import type { Tag } from "@/lib/types";

type Props = { value: string[]; onChange: (tags: string[]) => void; known: Tag[] };

/** Type a tag and press Enter or comma; existing tags are suggested and keep their colour. */
export function TagInput({ value, onChange, known }: Props) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const colorOf = (name: string) => known.find((t) => t.name.toLowerCase() === name.toLowerCase())?.color ?? "gray";

  const add = (raw: string) => {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (name && !value.some((v) => v.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft("");
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1">
          <TagPill name={t} color={colorOf(t)} />
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove tag ${t}`} className="-ml-1 grid size-4 place-items-center rounded text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
        </span>
      ))}
      <input
        value={draft} list={listId} onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)} maxLength={60} placeholder={value.length ? "" : "Add a tag"} aria-label="Add a tag"
        className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-[14px] outline-none placeholder:text-muted-foreground"
      />
      <datalist id={listId}>{known.filter((t) => !value.some((v) => v.toLowerCase() === t.name.toLowerCase())).map((t) => <option key={t.id} value={t.name} />)}</datalist>
    </div>
  );
}
