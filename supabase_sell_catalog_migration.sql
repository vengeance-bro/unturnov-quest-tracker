-- Shared Unturnov item catalog extensions; adds only items users discover that are
-- missing from the static community catalog. No quests or crafting progress touched.
create table if not exists public.unturnov_item_catalog (
 item_key text primary key check (char_length(item_key) between 1 and 140),
 name text not null check (char_length(name) between 1 and 140),
 category text not null default 'Added by players',
 created_at timestamptz not null default now()
);
alter table public.unturnov_item_catalog enable row level security;
revoke all on public.unturnov_item_catalog from anon,authenticated;
grant select,insert on public.unturnov_item_catalog to authenticated;
drop policy if exists "approved group reads item catalog" on public.unturnov_item_catalog;
drop policy if exists "approved group adds item catalog" on public.unturnov_item_catalog;
create policy "approved group reads item catalog" on public.unturnov_item_catalog
 for select to authenticated
 using (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
create policy "approved group adds item catalog" on public.unturnov_item_catalog
 for insert to authenticated
 with check (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
