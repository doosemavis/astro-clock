import type { Subject } from "./types.ts";

/** Signed-in tiers that can see interpretations (anonymous sees none). */
export type Tier = "free" | "pro";

export const FREE_TEASER_SUBJECTS = ["sun", "moon", "ascendant"] as const;

export function isTeaser(subject: Subject): boolean {
  return (FREE_TEASER_SUBJECTS as readonly string[]).includes(subject);
}

/**
 * Which field a tier may see for a subject:
 *  - pro  → "body" (full) for everything
 *  - free → "summary" for teaser subjects, otherwise null (hidden)
 * NOTE: this is policy only. The Pro `body` text is never delivered to a non-Pro
 * client — enforcement lives in Supabase RLS (a later plan), not in this function.
 */
export function visibleField(tier: Tier, subject: Subject): "summary" | "body" | null {
  if (tier === "pro") return "body";
  return isTeaser(subject) ? "summary" : null;
}
