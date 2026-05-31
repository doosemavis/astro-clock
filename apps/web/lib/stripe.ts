// Server-side Stripe client. Never import this into a Client Component.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  // Surface misconfiguration early (security rule: validate required secrets at startup).
  console.warn("[stripe] STRIPE_SECRET_KEY is not set — payment routes will fail.");
}

export const stripe = new Stripe(key ?? "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PRICES = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "",
  annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? "",
};
