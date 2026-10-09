import {
  AlertTriangle, CalendarDays, CheckCheck, ClipboardList, HelpCircle, Lightbulb, Mail, PhoneCall, Sparkles, Target, UserRound, UserRoundCheck, type LucideIcon,
} from "lucide-react";

export type Skill = {
  id: string;
  title: string;
  description: string;
  /** What gets sent to Ask Fred when the skill runs */
  prompt: string;
  icon: LucideIcon;
  /** Tile colour (Tailwind classes) */
  tile: string;
  group: "Recommended" | "Popular" | "Yours";
};

/** AI Skills are saved prompts: running one sends it to Ask Fred. */
export const SKILLS: Skill[] = [
  { id: "key-ideas", title: "Key Ideas", description: "Pull out the main ideas discussed across your meetings.", prompt: "What were the key ideas discussed across my recent meetings?", icon: Lightbulb, tile: "bg-amber-500", group: "Recommended" },
  { id: "decisions", title: "Key Decisions", description: "What was decided, by whom, and in which meeting.", prompt: "What key decisions were made across my recent meetings?", icon: Target, tile: "bg-emerald-500", group: "Recommended" },
  { id: "action-digest", title: "Action Items Digest", description: "Every open task from recent meetings, grouped by owner.", prompt: "List all open action items from my recent meetings, grouped by owner", icon: CheckCheck, tile: "bg-sky-500", group: "Recommended" },
  { id: "risks", title: "Risks & Blockers", description: "Problems, delays and open concerns that came up.", prompt: "What risks, blockers or concerns were raised in my recent meetings?", icon: AlertTriangle, tile: "bg-rose-500", group: "Popular" },
  { id: "follow-up", title: "Follow-up Email", description: "A draft recap you can send to attendees.", prompt: "Draft a short follow-up email summarizing my most recent meeting and its next steps", icon: Mail, tile: "bg-violet-500", group: "Popular" },
  { id: "questions", title: "Open Questions", description: "Questions that were asked but never answered.", prompt: "Which questions were raised in my meetings that were never answered?", icon: HelpCircle, tile: "bg-teal-500", group: "Popular" },
  { id: "customer", title: "Customer Feedback", description: "What customers asked for, liked or pushed back on.", prompt: "Summarize customer feedback, requests and objections from my meetings", icon: UserRoundCheck, tile: "bg-orange-500", group: "Popular" },
  { id: "sales", title: "Sales Call Review", description: "Needs, objections, pricing talk and agreed next steps.", prompt: "Review my sales and customer calls: needs, objections, pricing discussed and agreed next steps", icon: PhoneCall, tile: "bg-cyan-500", group: "Popular" },
  { id: "one-on-one", title: "1:1 Notes", description: "Topics, feedback and commitments from one-to-one meetings.", prompt: "Summarize topics, feedback and commitments from my 1:1 meetings", icon: UserRound, tile: "bg-fuchsia-500", group: "Popular" },
  { id: "prep", title: "Meeting Prep", description: "What to remember before your next conversation.", prompt: "What should I follow up on and remember before my next meeting?", icon: ClipboardList, tile: "bg-lime-500", group: "Popular" },
  { id: "weekly", title: "Weekly Digest", description: "A one-page summary of the week's meetings.", prompt: "Prepare a weekly digest based on my meetings", icon: CalendarDays, tile: "bg-indigo-500", group: "Popular" },
];

/** A prompt saved from a chat, shaped like a built-in skill. */
export function fromCustom(c: { id: string; title: string; prompt: string }): Skill {
  return { id: c.id, title: c.title, description: "Saved from a chat.", prompt: c.prompt, icon: Sparkles, tile: "bg-violet-500", group: "Yours" };
}

export function skillMatches(query: string, extra: Skill[] = []): Skill[] {
  const all = [...extra, ...SKILLS];
  const q = query.trim().toLowerCase();
  return q ? all.filter((s) => s.title.toLowerCase().includes(q)) : all;
}
