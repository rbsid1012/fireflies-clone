import type { Metadata } from "next";
import { CookiesPage } from "@/components/settings/pages/CookiesPage";

export const metadata: Metadata = { title: "Cookies" };

export default function Page() {
  return <CookiesPage />;
}
