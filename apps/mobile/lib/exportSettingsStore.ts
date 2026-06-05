import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_EXPORT_SETTINGS, parseExportSettings } from "./exportSettings";
import type { ExportSettings } from "./exportSettings";

const KEY = "movestar.exportSettings.v1";

/** Load saved export toggles, or defaults if absent/corrupt. */
export async function loadExportSettings(): Promise<ExportSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? parseExportSettings(JSON.parse(raw)) : { ...DEFAULT_EXPORT_SETTINGS };
  } catch {
    return { ...DEFAULT_EXPORT_SETTINGS };
  }
}

/** Persist export toggles (local cache only; ignore write errors). */
export async function saveExportSettings(s: ExportSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* local cache only */
  }
}
