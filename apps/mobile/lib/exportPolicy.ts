import type { Tier } from "./entitlement.ts";

export type Framing = "branded" | "clean";

/** Pro exports are clean (no watermark/chrome); free and anonymous get the branded share card. */
export function framingFor(tier: Tier): Framing {
  return tier === "pro" ? "clean" : "branded";
}

/** The native Share sheet is Pro-only; free/anon get Save-to-Photos only. */
export function canShare(tier: Tier): boolean {
  return tier === "pro";
}
