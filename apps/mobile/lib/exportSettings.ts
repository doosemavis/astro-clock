/** Which optional overlays appear in the saved chart image. */
export interface ExportSettings {
  caption: boolean;          // Sun/Moon/Rising line
  dateTime: boolean;         // moment / birth date-time line
  placeLabel: boolean;       // birth place / chart label
  cosmicBackground: boolean; // starfield vs solid theme color
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  caption: true,
  dateTime: true,
  placeLabel: true,
  cosmicBackground: true,
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
    caption: bool("caption"),
    dateTime: bool("dateTime"),
    placeLabel: bool("placeLabel"),
    cosmicBackground: bool("cosmicBackground"),
  };
}
