import { cn } from "@/lib/utils";

/** Square initial tile (20px, as in the reference). */
export function UserTile({ name, className }: { name?: string; className?: string }) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-5 shrink-0 place-items-center rounded-[4px] bg-brand text-[12px] font-medium leading-none text-white", className)}
    >
      {initial}
    </span>
  );
}
