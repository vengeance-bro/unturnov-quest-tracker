-- Shared Keep/Sell decisions override the automatic Unturnov quest/crafting suggestion.
-- 'auto' removes the manual decision without deleting data.
-- This is additive; no existing quest, crafting or catalog rows are changed.
create table if not exists public.unturnov_sell_overrides (
 item_key text primary key check (char_length(item_key) between 1 and 150),
 decision text not null check (decision in ('auto','keep','sell')),
 updated_at timestamptz not null default now()
);
alter table public.unturnov_sell_overrides enable row level security;
revoke all on public.unturnov_sell_overrides from anon,authenticated;
grant select,insert,update on public.unturnov_sell_overrides to authenticated;
drop policy if exists "approved group reads sell decisions" on public.unturnov_sell_overrides;
drop policy if exists "approved group inserts sell decisions" on public.unturnov_sell_overrides;
drop policy if exists "approved group updates sell decisions" on public.unturnov_sell_overrides;
create policy "approved group reads sell decisions" on public.unturnov_sell_overrides
 for select to authenticated using (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
create policy "approved group inserts sell decisions" on public.unturnov_sell_overrides
 for insert to authenticated with check (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
create policy "approved group updates sell decisions" on public.unturnov_sell_overrides
 for update to authenticated using (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'))
 with check (auth.uid() is not null and lower(auth.jwt()->>'email') in
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
