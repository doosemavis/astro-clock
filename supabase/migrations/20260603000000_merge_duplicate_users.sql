-- 2026-06-03: one-time cleanup — merge pre-launch duplicate auth.users that share an email.
-- Canonical = earliest created_at (tie-break lowest id). Re-points birth_charts / subscriptions /
-- profiles to the canonical user, preserving exactly one primary chart, then deletes the
-- duplicates (FK cascade clears anything still pointing at them). Idempotent: a no-op once each
-- email maps to a single user. Pre-launch / data-loss acceptable — see
-- docs/specs/2026-06-03-account-linking-design.md §6.
do $$
declare
  dup        record;
  canonical  uuid;
  dupe_ids   uuid[];
  keep_prim  uuid;
begin
  for dup in
    select lower(email) as email_key
    from auth.users
    where email is not null
    group by lower(email)
    having count(*) > 1
  loop
    -- canonical = earliest created, then lowest id
    select id into canonical
    from auth.users
    where lower(email) = dup.email_key
    order by created_at asc, id asc
    limit 1;

    select array_agg(id) into dupe_ids
    from auth.users
    where lower(email) = dup.email_key and id <> canonical;

    -- profiles: backfill canonical's display_name from a dupe if canonical's is null
    update public.profiles c
    set display_name = (
      select display_name from public.profiles
      where id = any(dupe_ids) and display_name is not null
      order by created_at asc
      limit 1
    )
    where c.id = canonical
      and c.display_name is null
      and exists (
        select 1 from public.profiles
        where id = any(dupe_ids) and display_name is not null
      );

    -- birth_charts: keep exactly one primary, then re-point. If canonical already has a primary,
    -- demote all dupes' primaries; else keep the earliest dupe primary and demote the rest.
    if exists (select 1 from public.birth_charts where user_id = canonical and is_primary) then
      keep_prim := null;
    else
      select id into keep_prim
      from public.birth_charts
      where user_id = any(dupe_ids) and is_primary
      order by created_at asc, id asc
      limit 1;
    end if;

    update public.birth_charts
    set is_primary = false
    where user_id = any(dupe_ids) and is_primary
      and (keep_prim is null or id <> keep_prim);

    update public.birth_charts
    set user_id = canonical
    where user_id = any(dupe_ids);

    -- subscriptions (PK user_id): move the best dupe sub only if canonical has none. Any other
    -- dupe subs are dropped by the cascade on delete below.
    if not exists (select 1 from public.subscriptions where user_id = canonical) then
      update public.subscriptions
      set user_id = canonical
      where user_id = (
        select user_id from public.subscriptions
        where user_id = any(dupe_ids)
        order by (status in ('active', 'trialing')) desc, current_period_end desc nulls last
        limit 1
      );
    end if;

    -- delete the duplicate users; cascade clears their profiles + any leftover subs
    delete from auth.users where id = any(dupe_ids);
  end loop;
end $$;
