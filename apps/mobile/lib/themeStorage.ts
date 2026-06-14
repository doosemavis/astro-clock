import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "./chartModel.ts";
import { parseThemeMode, DEFAULT_THEME_MODE } from "./themeMode.ts";

const KEY = "movestar.themeMode.v1";

/** Load the saved theme mode, or the default ("system") if absent/corrupt. */
export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    return parseThemeMode(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

/** Persist the theme mode (local cache only; ignore write errors). */
export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {
    /* local cache only */
  }
}
