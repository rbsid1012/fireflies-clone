import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeSync } from "@/components/layout/ThemeSync";

/** Everything signed-in users see: the shell, behind the auth gate. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ThemeSync />
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
