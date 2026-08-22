-- ============================================================
-- Migration: multiplayer rooms (host-paced, no login required)
-- Open/permissive RLS by design: joining only requires a 5-digit
-- room code, so anyone with the code can read/write room state.
-- This is intentional for a fast, no-signup party experience —
-- not meant for anything with real stakes. Safe to re-run.
-- ============================================================

create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  host_guest_id text not null,
  game_id text not null default 'truth-or-lie',
  category_ids uuid[] not null default '{}',
  question_ids uuid[] not null default '{}',
  current_index int not null default -1,
  status text not null default 'lobby' check (status in ('lobby','playing','ended')),
  created_at timestamptz not null default now()
);

alter table rooms enable row level security;

drop policy if exists "rooms public read" on rooms;
create policy "rooms public read" on rooms for select using (true);
drop policy if exists "rooms public insert" on rooms;
create policy "rooms public insert" on rooms for insert with check (true);
drop policy if exists "rooms public update" on rooms;
create policy "rooms public update" on rooms for update using (true);

create table if not exists room_players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  guest_id text not null,
  nickname text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

alter table room_players enable row level security;

drop policy if exists "room_players public read" on room_players;
create policy "room_players public read" on room_players for select using (true);
drop policy if exists "room_players public insert" on room_players;
create policy "room_players public insert" on room_players for insert with check (true);

create table if not exists room_answers (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  question_index int not null,
  guest_id text not null,
  nickname text not null,
  answer boolean,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (room_id, question_index, guest_id)
);

alter table room_answers enable row level security;

drop policy if exists "room_answers public read" on room_answers;
create policy "room_answers public read" on room_answers for select using (true);
drop policy if exists "room_answers public insert" on room_answers;
create policy "room_answers public insert" on room_answers for insert with check (true);
