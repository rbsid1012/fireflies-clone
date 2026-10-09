"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground " +
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-60";

type FieldProps = React.ComponentProps<"input"> & { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, className, ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[14px] text-foreground/90">{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} className={cn(inputClass, className)} {...props} />
      {(error || hint) && (
        <p id={`${id}-msg`} className={cn("text-[13px]", error ? "text-destructive" : "text-muted-foreground")}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function PasswordField({ label, error, hint, className, ...props }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[14px] text-foreground/90">{label}</label>
      <div className="relative">
        <input
          id={id} type={visible ? "text" : "password"} aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined} className={cn(inputClass, "pr-11", className)} {...props}
        />
        <button
          type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={cn("text-[13px]", error ? "text-destructive" : "text-muted-foreground")}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function SubmitButton({ loading, children, className, ...props }: React.ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type="submit" disabled={loading || props.disabled}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-medium text-primary-foreground",
        "transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-70", className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">
      {children}
    </div>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> {children} <span className="h-px flex-1 bg-border" />
    </div>
  );
}
