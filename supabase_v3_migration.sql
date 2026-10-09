-- Unturnov Tracker v3: run once in Supabase SQL Editor.
-- Additive migration. Existing quest_profiles data is left unchanged.
-- Uses the access controls already configured on public.quest_profiles.
-- The first quest_profiles table must contain at least one profile row; this creates
-- empty placeholders only for profiles that are not present.
insert into public.quest_profiles (player, quests)
values ('Nolan','[]'::jsonb),('Tyler','[]'::jsonb),('Kalob','[]'::jsonb)
on conflict (player) do nothing;

create table if not exists public.quest_events (
  seq bigint generated always as identity unique,
  event_id uuid primary key,
  player text not null check (player in ('Nolan','Tyler','Kalob')),
  quest_id text not null,
  kind text not null check (kind in (
    'quest_created','quest_edited','quest_deleted','quest_restored',
    'goal_delta','goal_set','quest_pinned','quest_note'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  author_uid uuid default auth.uid()
);
create index if not exists quest_events_player_seq on public.quest_events (player,seq);
alter table public.quest_events enable row level security;
revoke all on public.quest_events from anon, authenticated;
grant select, insert on public.quest_events to authenticated;
drop policy if exists "approved group reads quest events" on public.quest_events;
drop policy if exists "approved group writes quest events" on public.quest_events;
create policy "approved group reads quest events"
  on public.quest_events for select to authenticated
  using (exists (select 1 from public.quest_profiles p where p.player='Nolan'));
create policy "approved group writes quest events"
  on public.quest_events for insert to authenticated
  with check (auth.uid() is not null and
    exists (select 1 from public.quest_profiles p where p.player='Nolan'));

-- One-time safe import of existing saved quest snapshots, preserving IDs and counts.
-- Deterministic event_id makes rerunning this migration safe (ON CONFLICT DO NOTHING).
insert into public.quest_events(event_id,player,quest_id,kind,payload)
select md5('unturnov-migrate-v1:'||p.player||':'||(q.value->>'id'))::uuid,
       p.player,q.value->>'id','quest_created',jsonb_build_object('quest',q.value)
from public.quest_profiles p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.quests)='array' then p.quests else '[]'::jsonb end
) q
where q.value ? 'id'
on conflict (event_id) do nothing;

-- Updates and deletions are not granted to browser users; events form a permanent
-- append-only history. Optional database/platform backups should be configured separately.
