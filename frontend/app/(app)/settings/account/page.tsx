import type { Metadata } from "next";
import { AccountPage } from "@/components/settings/pages/AccountPage";

export const metadata: Metadata = { title: "Account" };

export default function Page() {
  return <AccountPage />;
}
