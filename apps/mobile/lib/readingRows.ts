import { natalRequests, titleFor, isTeaser, TEASER_BANK } from "@astro/interpretations";
import type { Positions } from "@astro/engine";

export type ReadingRowState = "teaser" | "locked" | "comingSoon";

export interface ReadingRow {
  key: string;
  title: string;
  state: ReadingRowState;
  summary?: string; // present when state === "teaser"
}

/** Natal SIGN readings (rising + each planet's sign) as view-models.
 *  Teaser subjects (sun/moon/rising) show their summary; others are gated:
 *  locked for free users, "coming soon" for Pro (full Pro content not built yet). */
export function buildReadingRows(natalPos: Positions, ascLon: number, isPro: boolean): ReadingRow[] {
  return natalRequests(natalPos, ascLon)
    .filter((r) => r.kind === "sign")
    .map((r) => {
      const title = titleFor(r.key);
      if (isTeaser(r.subject)) {
        return { key: r.key, title, state: "teaser" as const, summary: TEASER_BANK[r.key]?.summary ?? "" };
      }
      return { key: r.key, title, state: (isPro ? "comingSoon" : "locked") as ReadingRowState };
    });
}
