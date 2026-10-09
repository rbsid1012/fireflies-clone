import { CheckCheck, FileText, ListChecks } from "lucide-react";

/** The purple panel beside the auth forms: a small, drawn preview of what the product produces. */
export function AuthShowcase() {
  return (
    <div className="relative hidden h-full flex-col items-center justify-center overflow-hidden bg-[#1f1a4a] p-10 lg:flex" aria-hidden="true">
      <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-[#c5265f]/20 blur-3xl" />
      <div className="relative w-full max-w-[460px] space-y-4">
        <div className="rounded-2xl bg-white p-5 text-[#16161a] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-[14px] font-medium">
            <FileText className="size-4 text-[#623ae6]" /> Q4 Launch Planning
          </div>
          <p className="mt-3 text-[13px] font-medium">Overview</p>
          <p className="mt-1 text-[13px] leading-5 text-black/60">The team agreed on the November launch plan, the message, and who owns each deliverable.</p>
          <p className="mt-4 flex items-center gap-2 text-[13px] font-medium"><ListChecks className="size-4 text-[#623ae6]" /> Action items</p>
          <ul className="mt-2 space-y-2 text-[13px]">
            {[["Deliver launch copy to design", "Nina", "bg-[#8b7cf6]"], ["Introduce two beta customers", "Priya", "bg-[#f2994a]"], ["Scope the in-app banner", "Aisha", "bg-[#2dbf9b]"]].map(([t, who, c]) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="grid size-4 place-items-center rounded border border-black/20" />
                <span className="flex-1 truncate text-black/75">{t}</span>
                <span className={`rounded-full ${c} px-2 py-0.5 text-[11px] font-medium text-black/75`}>{who}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ml-10 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-white/90 backdrop-blur">
          <p className="text-[12px] text-white/50">Ask Fred</p>
          <p className="mt-1 text-[14px]">What did we decide about the launch date?</p>
          <p className="mt-2 flex items-start gap-2 text-[13px] text-white/70"><CheckCheck className="mt-0.5 size-4 shrink-0 text-[#2dbf9b]" /> November 12, with email and Slack as the headline channels.</p>
        </div>
      </div>
    </div>
  );
}
