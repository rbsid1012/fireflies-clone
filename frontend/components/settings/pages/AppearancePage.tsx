"use client";

import { Languages, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useSettings } from "@/hooks/useSettings";
import { applyTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Group, Row, SettingsPage } from "../primitives";

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];
const CURRENT_ICON: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

export function AppearancePage() {
  const settings = useSettings();
  const { save } = useSaveSettings();
  const theme = settings.data?.appearance.theme;
  const HeaderIcon = CURRENT_ICON[theme ?? "dark"];
  return (
    <SettingsPage title="Language & Appearance" description="How the app looks on this device.">
      <Group title="Language & Appearance">
        <div className="flex gap-3 px-6 py-5">
          <HeaderIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[14px] text-foreground">
              Theme <span className="rounded bg-iris-chip px-1.5 py-0.5 text-[11px] leading-none text-iris-soft">BETA</span>
            </p>
            <p className="mt-1 text-[13px] leading-5 text-fg3">Choose how the application looks. Select System to automatically match your device settings.</p>
            {settings.isPending ? <Skeleton className="mt-4 h-[81px] w-[324px]" /> : (
              <div role="radiogroup" aria-label="Colour theme" className="mt-4 flex flex-wrap gap-3">
                {THEMES.map((t) => {
                  const on = theme === t.value;
                  return (
                    <button
                      key={t.value} type="button" role="radio" aria-checked={on}
                      onClick={() => { applyTheme(t.value); save({ appearance: { theme: t.value } }); }}
                      className={cn(
                        "flex h-[81px] w-[100px] flex-col items-center justify-center gap-2.5 rounded-lg border text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                        on ? "border-iris bg-iris-chip text-iris" : "border-border bg-background text-foreground hover:bg-muted/60",
                      )}
                    >
                      <t.icon className={cn("size-5", on ? "text-iris" : "text-muted-foreground")} strokeWidth={1.5} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Group>
      <Group title="Language">
        <Row icon={Languages} title="Interface language" description="The app is available in English. Summaries and answers can be written in other languages under Recording & Privacy.">
          <span className="text-[14px] text-muted-foreground">English</span>
        </Row>
      </Group>
    </SettingsPage>
  );
}
