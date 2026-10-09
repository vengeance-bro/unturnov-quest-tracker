-- Unturnov Tracker: run in your OWN Supabase project SQL Editor.
-- Replace the three example email addresses BEFORE running this script.
-- Only these accounts may read/write the three shared player tabs.
create table if not exists public.quest_profiles (
  player text primary key check (player in ('Nolan','Tyler','Kalob')),
  quests jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.quest_profiles enable row level security;
revoke all on public.quest_profiles from anon;
grant select, insert, update on public.quest_profiles to authenticated;
drop policy if exists "approved players can read" on public.quest_profiles;
drop policy if exists "approved players can insert" on public.quest_profiles;
drop policy if exists "approved players can update" on public.quest_profiles;
create policy "approved players can read"
  on public.quest_profiles for select to authenticated
  using ((auth.jwt() ->> 'email') in (
    'nolan@example.com', 'tyler@example.com', 'kalob@example.com'
  ));
create policy "approved players can insert"
  on public.quest_profiles for insert to authenticated
  with check ((auth.jwt() ->> 'email') in (
    'nolan@example.com', 'tyler@example.com', 'kalob@example.com'
  ));
create policy "approved players can update"
  on public.quest_profiles for update to authenticated
  using ((auth.jwt() ->> 'email') in (
    'nolan@example.com', 'tyler@example.com', 'kalob@example.com'
  ))
  with check ((auth.jwt() ->> 'email') in (
    'nolan@example.com', 'tyler@example.com', 'kalob@example.com'
  ));
-- Turn on Realtime for quest_profiles in Supabase Dashboard -> Database -> Publications if needed.
-- This site currently polls every 12 seconds and does NOT require Realtime.
