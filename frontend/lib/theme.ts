export type ThemePreference = "dark" | "light" | "system";

export const THEME_KEY = "ff_theme";

/**
 * Runs in <head> before first paint so a light-theme user never sees a dark flash. It must be
 * self-contained: no imports, no closures.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"dark";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function resolveDark(pref: ThemePreference): boolean {
  return pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function applyTheme(pref: ThemePreference): void {
  const dark = resolveDark(pref);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* the setting is still saved on the server */
  }
}
