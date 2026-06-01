-- Data-integrity backstop: at most one primary birth chart per user.
create unique index if not exists birth_charts_one_primary
  on public.birth_charts (user_id)
  where is_primary;
