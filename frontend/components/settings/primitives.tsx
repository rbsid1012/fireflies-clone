import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsPage({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[694px] space-y-7 px-4 pb-16 pt-9 md:px-0">
      <div className="sr-only">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A titled group of rows in one rounded card, like the reference's "Recording", "Email Notification"... */
export function Group({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-6">
      <h2 className="mb-3.5 text-[14px] text-fg2">{title}</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

type RowProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** The control, aligned right (or below the text on narrow screens). */
  children?: React.ReactNode;
  badge?: string;
  /** Stack the control under the text on all sizes (for wide controls like text areas). */
  stacked?: boolean;
  disabled?: boolean;
};

export function Row({ icon: Icon, title, description, children, badge, stacked, disabled }: RowProps) {
  return (
    <div className={cn("flex gap-4 px-6 py-4", stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between", disabled && "opacity-60")}>
      <div className="flex min-w-0 gap-3">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] text-foreground">
            {title}
            {badge && <span className="rounded bg-iris-chip px-1.5 py-0.5 text-[11px] leading-none text-iris-soft">{badge}</span>}
          </p>
          {description && <p className="mt-0.5 text-[13px] leading-5 text-fg3">{description}</p>}
        </div>
      </div>
      {children !== undefined && <div className={cn("shrink-0", stacked ? "w-full" : "sm:w-auto")}>{children}</div>}
    </div>
  );
}

/** A page for something this app doesn't have, said plainly (no controls that look real but do nothing). */
export function NotAvailable({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border bg-card text-muted-foreground"><Icon className="size-6" strokeWidth={1.5} /></div>
      <h2 className="text-[17px] font-medium">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}
