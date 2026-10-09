/**
 * Backend tags carry a colour *name* (see TAG_COLORS in the seed). Class names are written out
 * in full so Tailwind can see them; building them from the name at runtime would be purged.
 */
const DOT: Record<string, string> = {
  blue: "bg-blue-400", indigo: "bg-indigo-400", green: "bg-green-400", teal: "bg-teal-400",
  purple: "bg-purple-400", violet: "bg-violet-400", orange: "bg-orange-400", amber: "bg-amber-400",
  pink: "bg-pink-400", red: "bg-red-400", rose: "bg-rose-400", cyan: "bg-cyan-400", gray: "bg-zinc-400",
};

export function tagDotClass(color: string): string {
  return DOT[color] ?? DOT.gray;
}
