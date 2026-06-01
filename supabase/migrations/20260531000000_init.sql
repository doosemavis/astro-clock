-- Baseline schema as an idempotent migration, so supabase/migrations/ fully reproduces the
-- database (safe to apply on a fresh DB or an already-provisioned one). Mirrors schema.sql.
-- The unique-primary index lives in 20260601000001_birth_charts_one_primary.sql (runs after).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.birth_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text,
  birth_date date not null,
  birth_time time not null,
  tz_offset numeric not null,
  is_dst boolean not null default false,
  lat numeric not null,
  lon numeric not null,
  place_label text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists birth_charts_user_idx on public.birth_charts (user_id);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles       enable row level security;
alter table public.birth_charts   enable row level security;
alter table public.subscriptions  enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "charts_self_select" on public.birth_charts;
create policy "charts_self_select" on public.birth_charts for select using (auth.uid() = user_id);
drop policy if exists "charts_self_insert" on public.birth_charts;
create policy "charts_self_insert" on public.birth_charts for insert with check (auth.uid() = user_id);
drop policy if exists "charts_self_update" on public.birth_charts;
create policy "charts_self_update" on public.birth_charts for update using (auth.uid() = user_id);
drop policy if exists "charts_self_delete" on public.birth_charts;
create policy "charts_self_delete" on public.birth_charts for delete using (auth.uid() = user_id);

drop policy if exists "subs_self_select" on public.subscriptions;
create policy "subs_self_select" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
