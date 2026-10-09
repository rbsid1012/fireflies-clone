import { Webhook, Hash, FileText, Calendar, Video, Link2, Workflow, ListChecks, Users, Database, type LucideIcon } from "lucide-react";

export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Set for the two integrations that actually deliver; everything else is shown as not available. */
  kind?: "slack" | "webhook";
};

export const CATALOG: CatalogEntry[] = [
  { id: "slack", kind: "slack", name: "Slack", icon: Hash, description: "Post a short recap to a channel when a meeting is added." },
  { id: "webhook", kind: "webhook", name: "Webhook", icon: Webhook, description: "Send the meeting as signed JSON to any HTTPS endpoint." },
  { id: "notion", name: "Notion", icon: FileText, description: "Save notes and action items to a Notion page." },
  { id: "gdocs", name: "Google Docs", icon: FileText, description: "Create a document for every meeting." },
  { id: "calendar", name: "Google Calendar", icon: Calendar, description: "Pick up upcoming meetings automatically." },
  { id: "zoom", name: "Zoom", icon: Video, description: "Import cloud recordings from Zoom." },
  { id: "zapier", name: "Zapier", icon: Workflow, description: "Connect to thousands of apps without code." },
  { id: "asana", name: "Asana", icon: ListChecks, description: "Turn action items into tasks." },
  { id: "hubspot", name: "HubSpot", icon: Users, description: "Log calls and notes against contacts." },
  { id: "salesforce", name: "Salesforce", icon: Database, description: "Sync meeting notes to opportunities." },
  { id: "links", name: "Public links", icon: Link2, description: "Share a read-only link to a meeting." },
];
