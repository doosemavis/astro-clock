// RevenueCat webhook → mirror entitlement into public.subscriptions (service role).
// Auth: RevenueCat sends a configured Authorization header; we compare to REVENUECAT_WEBHOOK_SECRET.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { rcEventToRow } from "../_shared/rcEventToRow.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (req.headers.get("Authorization") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const row = rcEventToRow((body.event ?? {}) as Parameters<typeof rcEventToRow>[0]);
  // Anonymous / unattributable event: acknowledge so RevenueCat stops retrying, but write nothing.
  if (!row) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Ordering guard: don't let a delayed/duplicate event overwrite newer state.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("updated_at")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (existing?.updated_at && new Date(existing.updated_at) > new Date(row.updated_at)) {
    return new Response(JSON.stringify({ ok: true, stale: true }), { status: 200 });
  }

  const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("subscriptions upsert failed:", error.message);
    return new Response("DB error", { status: 500 }); // non-2xx → RevenueCat retries
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
