/** Which optional elements appear in the saved chart image. The Sun/Moon/Rising caption is
 *  always shown and birth location is never shown, so neither is a setting here. */
export interface ExportSettings {
  dateTime: boolean;         // Date & time line
  cosmicBackground: boolean; // starfield vs. solid theme color
  logo: boolean;             // MoveStar wordmark + movestar.app footer (Pro-only toggle; free is always branded)
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  dateTime: true,
  cosmicBackground: true,
  logo: true,
};

export type ExportToggleKey = keyof ExportSettings;

/** Immutable flip of a single switch. */
export function toggleSetting(s: ExportSettings, key: ExportToggleKey): ExportSettings {
  return { ...s, [key]: !s[key] };
}

/** Parse persisted JSON into ExportSettings; any missing/invalid field falls back to default. */
export function parseExportSettings(raw: unknown): ExportSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EXPORT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const bool = (k: ExportToggleKey): boolean =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_EXPORT_SETTINGS[k];
  return {
    dateTime: bool("dateTime"),
    cosmicBackground: bool("cosmicBackground"),
    logo: bool("logo"),
  };
}
