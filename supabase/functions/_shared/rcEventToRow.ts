// Pure mapper: a RevenueCat webhook event → a public.subscriptions upsert row.
// No Deno/supabase imports, so it unit-tests under `node --test` and imports cleanly in Deno.

export interface RcEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  store?: string;                 // PLAY_STORE | APP_STORE | STRIPE | RC_BILLING | ...
  period_type?: string;           // NORMAL | TRIAL | INTRO
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
}

export interface SubscriptionRow {
  user_id: string;
  status: "active" | "trialing" | "expired";
  current_period_end: string | null;
  product_id: string | null;
  provider: "play" | "apple" | "stripe";
  updated_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITLEMENT_ENDING = new Set(["EXPIRATION", "REFUND", "TRANSFER"]);

function providerOf(store: string | undefined): SubscriptionRow["provider"] {
  if (store === "APP_STORE") return "apple";
  if (store === "STRIPE" || store === "RC_BILLING") return "stripe";
  return "play"; // PLAY_STORE and anything else default to play (we are Play-first)
}

/** Map an event to a row, or null when there is no signed-in user to attribute it to
 *  (anonymous RevenueCat id) — the caller acks 200 without writing. */
export function rcEventToRow(event: RcEvent): SubscriptionRow | null {
  const userId = event.app_user_id;
  if (!userId || !UUID_RE.test(userId)) return null;

  const expMs = typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  const ending = ENTITLEMENT_ENDING.has(event.type ?? "");
  const isActive = !ending && expMs !== null && expMs > Date.now();
  const isTrial = event.period_type === "TRIAL" || event.period_type === "INTRO";

  return {
    user_id: userId,
    status: isActive ? (isTrial ? "trialing" : "active") : "expired",
    current_period_end: expMs !== null ? new Date(expMs).toISOString() : null,
    product_id: event.product_id ?? null,
    provider: providerOf(event.store),
    updated_at: new Date(event.event_timestamp_ms ?? Date.now()).toISOString(),
  };
}
