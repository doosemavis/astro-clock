// Pure Pro-mode policy: which chart modes require Pro, and how to clamp the active mode
// when entitlement is lost. Imports only the erased Mode type, so it runs under node --test.
import type { Mode } from "./chartModel.ts";

/** Chart modes that require a Pro subscription. */
export const PRO_MODES: readonly Mode[] = ["moment", "range", "compare"];

/** True iff the mode requires Pro. */
export function isProMode(mode: Mode): boolean {
  return PRO_MODES.includes(mode);
}

/** The mode the app should display given entitlement: a non-Pro user sitting in a Pro mode
 *  (e.g. after a subscription expires) is snapped back to "birth". Otherwise unchanged. */
export function clampMode(mode: Mode, isPro: boolean): Mode {
  if (!isPro && isProMode(mode)) return "birth";
  return mode;
}

/** True iff the Coordinates tab should show the Pro lock: the table is free in the free
 *  views (Birth/Now) and Pro-only in the Pro modes (Date/Range/Compare). */
export function coordinatesLocked(mode: Mode, isPro: boolean): boolean {
  return !isPro && isProMode(mode);
}
