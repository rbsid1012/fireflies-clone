import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { Providers } from "@/components/layout/Providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fireflies Clone", template: "%s · Fireflies Clone" },
  description: "Turn meeting transcripts into summaries, action items and answers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may switch the `dark` class before React hydrates
    <html lang="en" className={`${inter.variable} dark h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        <Providers>
          <AuthProvider>
            {children}
            <CookieBanner />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
