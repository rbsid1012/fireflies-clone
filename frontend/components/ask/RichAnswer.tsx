"use client";

import { parseAnswer } from "@/lib/rich-text";

type Props = { text: string; onCite: (meetingId: number | null, ms: number) => void };

export function RichAnswer({ text, onCite }: Props) {
  const blocks = parseAnswer(text);
  const render = (inline: ReturnType<typeof parseAnswer>[number]["inline"]) =>
    inline.map((p, i) => {
      if (p.type === "bold") return <strong key={i} className="font-semibold text-foreground">{p.text}</strong>;
      if (p.type === "italic") return <em key={i}>{p.text}</em>;
      if (p.type === "cite") {
        return (
          <button key={i} type="button" onClick={() => onCite(p.meetingId, p.ms)} className="mx-0.5 rounded bg-primary/20 px-1.5 text-[12px] tabular-nums text-foreground transition-colors hover:bg-primary/35">
            {p.label}
          </button>
        );
      }
      return <span key={i}>{p.text}</span>;
    });
  return (
    <div className="space-y-1.5 text-[14px] leading-6 text-foreground/90">
      {blocks.map((b, i) =>
        b.type === "li" ? (
          <p key={i} className="flex gap-2 pl-1"><span aria-hidden="true" className="select-none text-muted-foreground">•</span><span className="min-w-0 flex-1">{render(b.inline)}</span></p>
        ) : (
          <p key={i}>{render(b.inline)}</p>
        ),
      )}
    </div>
  );
}
