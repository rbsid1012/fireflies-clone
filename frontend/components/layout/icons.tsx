import type { SVGProps } from "react";

/** AskFred's mascot: a dome-headed robot with antennae, as in the reference. */
export function FredIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className} {...props}>
      <defs>
        <linearGradient id="fred-g" x1="8" y1="4" x2="8" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7d6cf7" /><stop offset="1" stopColor="#d79cff" />
        </linearGradient>
      </defs>
      <path d="M5.2 4.6V2.3M10.8 4.6V2.3" stroke="#8c78f0" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="5.2" cy="1.9" r="0.9" fill="#a994f8" /><circle cx="10.8" cy="1.9" r="0.9" fill="#a994f8" />
      <path d="M1.6 11.3C1.6 7.6 4.4 4.7 8 4.7s6.4 2.9 6.4 6.6c0 1.6-2.9 2.6-6.4 2.6s-6.4-1-6.4-2.6Z" fill="url(#fred-g)" />
      <rect x="3" y="7.4" width="10" height="4" rx="2" fill="#3c3071" />
      <path d="M5.2 9.5c.3-.7 1.3-.7 1.6 0M9.2 9.5c.3-.7 1.3-.7 1.6 0" stroke="#e8e4f7" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}

/** A small envelope in four colours for "Try Email Assistant" (original artwork, not a brand logo). */
export function MailMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className} {...props}>
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="#e8e8ec" strokeWidth="1" />
      <path d="M2 4.2 8 9l6-4.8" stroke="#f26b5b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.2 12.4 6 8.2" stroke="#4d8df7" strokeWidth="1" strokeLinecap="round" /><path d="M13.8 12.4 10 8.2" stroke="#3cba70" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
