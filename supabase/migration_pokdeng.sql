-- ============================================================
-- Migration: ไพ่ป๊อกเด้ง (Pok Deng) multiplayer room
-- Same trust model as the other live-room games: open RLS,
-- room-code based, no login. Chips are virtual, not real money.
-- Safe to re-run.
-- ============================================================

create table if not exists pokdeng_rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  host_guest_id text not null,
  status text not null default 'lobby' check (status in ('lobby','betting','acting','reveal','ended')),
  turn_order text[] not null default '{}',
  banker_guest_id text,
  round_number int not null default 0,
  min_bet int not null default 5,
  max_bet int not null default 50,
  acting_guest_id text,
  deck jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table pokdeng_rooms enable row level security;
drop policy if exists "pokdeng_rooms public read" on pokdeng_rooms;
create policy "pokdeng_rooms public read" on pokdeng_rooms for select using (true);
drop policy if exists "pokdeng_rooms public insert" on pokdeng_rooms;
create policy "pokdeng_rooms public insert" on pokdeng_rooms for insert with check (true);
drop policy if exists "pokdeng_rooms public update" on pokdeng_rooms;
create policy "pokdeng_rooms public update" on pokdeng_rooms for update using (true);

create table if not exists pokdeng_players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references pokdeng_rooms(id) on delete cascade,
  guest_id text not null,
  nickname text not null,
  chips int not null default 200,
  joined_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

alter table pokdeng_players enable row level security;
drop policy if exists "pokdeng_players public read" on pokdeng_players;
create policy "pokdeng_players public read" on pokdeng_players for select using (true);
drop policy if exists "pokdeng_players public insert" on pokdeng_players;
create policy "pokdeng_players public insert" on pokdeng_players for insert with check (true);
drop policy if exists "pokdeng_players public update" on pokdeng_players;
create policy "pokdeng_players public update" on pokdeng_players for update using (true);

create table if not exists pokdeng_bets (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references pokdeng_rooms(id) on delete cascade,
  round_number int not null,
  guest_id text not null,
  amount int not null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, guest_id)
);

alter table pokdeng_bets enable row level security;
drop policy if exists "pokdeng_bets public read" on pokdeng_bets;
create policy "pokdeng_bets public read" on pokdeng_bets for select using (true);
drop policy if exists "pokdeng_bets public insert" on pokdeng_bets;
create policy "pokdeng_bets public insert" on pokdeng_bets for insert with check (true);
drop policy if exists "pokdeng_bets public update" on pokdeng_bets;
create policy "pokdeng_bets public update" on pokdeng_bets for update using (true);

create table if not exists pokdeng_hands (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references pokdeng_rooms(id) on delete cascade,
  round_number int not null,
  guest_id text not null,
  cards jsonb not null default '[]'::jsonb,
  stayed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, guest_id)
);

alter table pokdeng_hands enable row level security;
drop policy if exists "pokdeng_hands public read" on pokdeng_hands;
create policy "pokdeng_hands public read" on pokdeng_hands for select using (true);
drop policy if exists "pokdeng_hands public insert" on pokdeng_hands;
create policy "pokdeng_hands public insert" on pokdeng_hands for insert with check (true);
drop policy if exists "pokdeng_hands public update" on pokdeng_hands;
create policy "pokdeng_hands public update" on pokdeng_hands for update using (true);
