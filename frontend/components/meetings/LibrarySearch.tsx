"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Search, X } from "lucide-react";

type Props = { value: string; onCommit: (q: string) => void };

/**
 * Text filter that is debounced into the URL. The URL is the source of truth, so when it changes
 * for another reason (Clear all, back button) the box follows; changes we caused ourselves are
 * recognised and don't overwrite what the user has typed since.
 */
export function LibrarySearch({ value, onCommit }: Props) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const [committed, setCommitted] = useState(value);

  if (value !== seen) {
    setSeen(value);
    if (value !== committed) {
      setText(value);
      setCommitted(value);
    }
  }

  const commit = useEffectEvent((q: string) => {
    setCommitted(q);
    onCommit(q);
  });

  useEffect(() => {
    const q = text.trim();
    if (q === committed) return;
    const timer = setTimeout(() => commit(q), 300);
    return () => clearTimeout(timer);
  }, [text, committed]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setText("")}
        maxLength={200}
        placeholder="Filter by title or transcript"
        aria-label="Filter meetings by title or transcript text"
        className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Clear text filter"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
