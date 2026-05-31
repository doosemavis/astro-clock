// Create a Stripe Checkout Session for a logged-in user.
// POST { plan: "monthly" | "annual" } -> { url }
import { NextResponse } from "next/server";
import { stripe, PRICES } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { plan } = await req.json().catch(() => ({ plan: "monthly" }));
  const price = plan === "annual" ? PRICES.annual : PRICES.monthly;
  if (!price) return NextResponse.json({ error: "Price not configured" }, { status: 500 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Reuse an existing Stripe customer if we have one; else let Checkout create it.
  const { data: existing } = await supabase
    .from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer: existing?.stripe_customer_id || undefined,
    customer_email: existing?.stripe_customer_id ? undefined : user.email!,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${site}/chart?checkout=success`,
    cancel_url: `${site}/chart?checkout=cancel`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
