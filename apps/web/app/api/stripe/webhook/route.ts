// Stripe webhook -> mirror subscription state into Postgres (service role, bypasses RLS).
// Configure the endpoint in Stripe to send checkout.session.completed and
// customer.subscription.{created,updated,deleted}.
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${String(err)}` }, { status: 400 });
  }

  const db = createServiceClient();

  async function upsertFromSubscription(sub: Stripe.Subscription) {
    const userId = (sub.metadata?.user_id as string | undefined) ?? null;
    if (!userId) return;
    await db.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: sub.items.data[0]?.price.id ?? null,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        if (!sub.metadata?.user_id && session.metadata?.user_id) {
          await stripe.subscriptions.update(sub.id, { metadata: { user_id: session.metadata.user_id } });
          sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id };
        }
        await upsertFromSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
