-- ============================================================
-- Migration: configurable daily play limit + admin reset capability
-- Safe to re-run.
-- ============================================================

-- Key-value settings table
create table if not exists app_settings (
  key text primary key,
  value text not null
);

alter table app_settings enable row level security;

drop policy if exists "settings readable by everyone" on app_settings;
create policy "settings readable by everyone"
  on app_settings for select
  using (true);

drop policy if exists "only admins can write settings" on app_settings;
create policy "only admins can write settings"
  on app_settings for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

insert into app_settings (key, value) values ('daily_play_limit', '3')
on conflict (key) do nothing;

-- Update the limit-check trigger to read the configurable value
create or replace function public.enforce_daily_play_limit()
returns trigger as $$
declare
  user_role text;
  play_count int;
  daily_limit int;
begin
  select role into user_role from profiles where id = new.user_id;

  if user_role is distinct from 'admin' then
    select coalesce(nullif(value, '')::int, 3) into daily_limit
    from app_settings where key = 'daily_play_limit';
    if daily_limit is null then
      daily_limit := 3;
    end if;

    select count(*) into play_count
    from scores
    where user_id = new.user_id
      and game_id = new.game_id
      and played_at >= date_trunc('day', now());

    if play_count >= daily_limit then
      raise exception 'DAILY_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Allow admins to delete score rows (needed to "reset" a player's quota)
drop policy if exists "admins can delete scores" on scores;
create policy "admins can delete scores"
  on scores for delete
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
