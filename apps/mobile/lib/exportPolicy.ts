import type { Tier } from "./entitlement.ts";

/** The native Share sheet is Pro-only; free/anon get Save-to-Photos only. */
export function canShare(tier: Tier): boolean {
  return tier === "pro";
}

/** Only Pro users can toggle the MoveStar logo; free/anon are always branded. */
export function canToggleLogo(tier: Tier): boolean {
  return tier === "pro";
}

/** Whether the MoveStar logo (wordmark + footer) appears on the export:
 *  free/anon are always branded; Pro follows their logo toggle. */
export function showLogo(tier: Tier, logoSetting: boolean): boolean {
  return tier === "pro" ? logoSetting : true;
}

/** Save-to-Photos requires an account; anonymous users must sign in/up first. */
export function canSave(tier: Tier): boolean {
  return tier !== "anonymous";
}
