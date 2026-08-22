-- ============================================================
-- Migration: daily play limit (server-side enforcement)
-- Members are capped at 3 plays/day per game. Admins are unlimited.
-- Safe to re-run.
-- ============================================================

create or replace function public.enforce_daily_play_limit()
returns trigger as $$
declare
  user_role text;
  play_count int;
  daily_limit int := 3;
begin
  select role into user_role from profiles where id = new.user_id;

  if user_role is distinct from 'admin' then
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

drop trigger if exists enforce_daily_play_limit_trigger on scores;
create trigger enforce_daily_play_limit_trigger
  before insert on scores
  for each row execute procedure public.enforce_daily_play_limit();
