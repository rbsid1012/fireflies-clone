import type { Metadata } from "next";
import { TeamMembersPage } from "@/components/settings/pages/TeamPages";

export const metadata: Metadata = { title: "Teammates and groups" };

export default function Page() {
  return <TeamMembersPage />;
}
