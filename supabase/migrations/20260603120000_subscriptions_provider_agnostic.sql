-- Make public.subscriptions provider-agnostic so Play (now), Stripe (web), and Apple
-- can all write to one table. Read path (status, current_period_end) is unchanged.
alter table public.subscriptions
  add column if not exists provider   text,   -- 'play' | 'stripe' | 'apple'
  add column if not exists product_id text;   -- generic product purchased (RC product id)

-- Backfill any existing rows as the provider they came from.
update public.subscriptions
  set provider = 'stripe'
  where provider is null and stripe_subscription_id is not null;
