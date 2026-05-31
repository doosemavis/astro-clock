// Single source of truth for the Option-A paywall gate.
// NOTE: client-side gating is "soft" by design (spec §6) — the ephemeris runs in the
// browser, so a technical user can bypass it. Harden with server-rendered paid assets later.

export type SubStatus =
  | "active" | "trialing" | "past_due" | "canceled" | "incomplete" | null;

export interface Subscription {
  status: SubStatus;
  currentPeriodEnd: string | null;
}

/** True when the user may use paid (living-chart) features. */
export function isSubscribed(sub: Subscription | null | undefined): boolean {
  if (!sub || !sub.status) return false;
  return sub.status === "active" || sub.status === "trialing";
}

/** Feature flags derived from subscription state — used across the UI. */
export interface Entitlements {
  natalChart: boolean;     // always free
  shareImage: boolean;     // always free (the viral seed)
  livingViews: boolean;    // Now / Date / Range
  transits: boolean;
  themes: boolean;
}

export function entitlements(sub: Subscription | null | undefined): Entitlements {
  const paid = isSubscribed(sub);
  return {
    natalChart: true,
    shareImage: true,
    livingViews: paid,
    transits: paid,
    themes: paid,
  };
}
