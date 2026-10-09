"use client";

import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { applyTheme } from "@/lib/theme";

/** Applies the saved theme preference, and follows the OS setting while it is "system". */
export function ThemeSync() {
  const theme = useSettings().data?.appearance.theme;

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
