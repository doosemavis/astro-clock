// Pure entitlement check over RevenueCat CustomerInfo. No SDK import so it runs under
// `node --test`. Accepts a structural subset of CustomerInfo (entitlements.active map).

/** The RevenueCat entitlement identifier that unlocks Pro. Must match the dashboard. */
export const PRO_ENTITLEMENT = "pro";

interface CustomerInfoLike {
  entitlements?: { active?: Record<string, unknown> | null } | null;
}

/** True iff the "pro" entitlement is currently active. Defensive against null/malformed input. */
export function isProFromCustomerInfo(info: CustomerInfoLike | null | undefined): boolean {
  const active = info?.entitlements?.active;
  if (!active || typeof active !== "object") return false;
  return PRO_ENTITLEMENT in active;
}
