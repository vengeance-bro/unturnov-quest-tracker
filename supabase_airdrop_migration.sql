-- Team-wide Airdrop ISR crafting tracker for the Unturnov quest tracker.
-- Additive: does not modify any existing quests, profiles, or quest events.
-- Signed-in users approved by the existing quest_profiles policies may share one build.
create table if not exists public.airdrop_events (
  seq bigint generated always as identity unique,
  event_id uuid primary key,
  item_key text not null check (char_length(item_key) between 1 and 80),
  kind text not null check (kind in ('material_delta','material_set','tool_set','stage_set')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  author_uid uuid default auth.uid()
);
create index if not exists airdrop_events_seq_idx on public.airdrop_events (seq);
alter table public.airdrop_events enable row level security;
revoke all on public.airdrop_events from anon, authenticated;
grant select, insert on public.airdrop_events to authenticated;
drop policy if exists "approved group reads airdrop events" on public.airdrop_events;
drop policy if exists "approved group writes airdrop events" on public.airdrop_events;
create policy "approved group reads airdrop events"
 on public.airdrop_events for select to authenticated
 using (auth.uid() is not null and exists
  (select 1 from public.quest_profiles p where p.player='Nolan'));
create policy "approved group writes airdrop events"
 on public.airdrop_events for insert to authenticated
 with check (auth.uid() is not null and exists
  (select 1 from public.quest_profiles p where p.player='Nolan'));
-- Event rows are immutable via browser API; each change is appended, so concurrent
-- increases from different players do not overwrite the previous changes.