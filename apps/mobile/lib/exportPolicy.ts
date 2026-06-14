import type { Tier } from "./entitlement.ts";

/** The native Share sheet is Pro-only; free/anon get Save-to-Photos only. */
export function canShare(tier: Tier): boolean {
  return tier === "pro";
}

/** Save-to-Photos requires an account; anonymous users must sign in/up first. */
export function canSave(tier: Tier): boolean {
  return tier !== "anonymous";
}
