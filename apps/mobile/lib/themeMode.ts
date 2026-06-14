import type { ThemeMode } from "./chartModel.ts";

/** Base day/night value for a theme mode: dark=0, light=1; system follows the OS scheme. */
export function themeTForMode(mode: ThemeMode, systemPrefersDark: boolean): number {
  if (mode === "light") return 1;
  if (mode === "dark") return 0;
  return systemPrefersDark ? 0 : 1; // "system"
}

export const DEFAULT_THEME_MODE: ThemeMode = "system";

/** Validate a persisted theme value; anything invalid (incl. legacy "auto") -> default "system". */
export function parseThemeMode(raw: string | null): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT_THEME_MODE;
}
