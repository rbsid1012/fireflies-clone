import { useId } from "react";
import { cn } from "@/lib/utils";

/** Original mark: three rising bars in a rounded tile (a waveform / meeting-minutes motif). */
export function BrandMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c5265f" />
          <stop offset="1" stopColor="#7f5af0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradient})`} />
      <rect x="5.5" y="12" width="3" height="6" rx="1.5" fill="#fff" />
      <rect x="10.5" y="8" width="3" height="10" rx="1.5" fill="#fff" />
      <rect x="15.5" y="5" width="3" height="13" rx="1.5" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[18px] font-medium tracking-tight", className)}>
      <BrandMark className="size-7" /> Fireflies Clone
    </span>
  );
}
