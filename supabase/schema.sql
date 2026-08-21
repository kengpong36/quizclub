-- ============================================================
-- QuizClub schema — run this once in Supabase SQL Editor
-- (Project → SQL Editor → New query → paste all → Run)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- PROFILES (one row per auth user) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by everyone"
  on profiles for select
  using (true);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- CATEGORIES ----------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  game_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, name)
);

alter table categories enable row level security;

create policy "categories are readable by everyone"
  on categories for select
  using (true);

create policy "only admins can write categories"
  on categories for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ---------- QUESTIONS ----------
create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  game_id text not null,
  category_id uuid references categories(id) on delete cascade,
  text text not null,
  answer boolean not null,
  explain text not null default '',
  created_at timestamptz not null default now()
);

alter table questions enable row level security;

create policy "questions are readable by everyone"
  on questions for select
  using (true);

create policy "only admins can write questions"
  on questions for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ---------- SCORES (leaderboard) ----------
create table if not exists scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  score int not null,
  total_questions int not null,
  best_streak int not null default 0,
  played_at timestamptz not null default now()
);

alter table scores enable row level security;

create policy "scores are readable by everyone"
  on scores for select
  using (true);

create policy "users can insert their own scores"
  on scores for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Promote your own account to admin after you sign up once:
--   update profiles set role = 'admin' where username = 'YOUR_USERNAME';
-- ============================================================
