export type Tier = "anonymous" | "free" | "pro";

/** Minimal shape of the public.subscriptions row we read. */
export interface SubscriptionRow {
  status?: string | null;
  current_period_end?: string | null;
}

/** Pure: derive Pro entitlement from a subscriptions row. null/expired/inactive → Free.
 *  isPro = status is active|trialing AND current_period_end is in the future. */
export function entitlementFromRow(row: SubscriptionRow | null): { isPro: boolean } {
  if (!row) return { isPro: false };
  const active = row.status === "active" || row.status === "trialing";
  const end = row.current_period_end ? Date.parse(row.current_period_end) : NaN;
  return { isPro: active && Number.isFinite(end) && end > Date.now() };
}

/** Pure: the access tier from auth + entitlement. Signed-out is always anonymous. */
export function tierOf(signedIn: boolean, isPro: boolean): Tier {
  if (!signedIn) return "anonymous";
  return isPro ? "pro" : "free";
}
