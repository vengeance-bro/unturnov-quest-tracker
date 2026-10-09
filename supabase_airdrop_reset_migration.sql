-- Allow one atomic, append-only shared reset event for Airdrop ISR progress.
-- Existing airdrop events are preserved; this only broadens the valid event types.
alter table public.airdrop_events drop constraint if exists airdrop_events_kind_check;
alter table public.airdrop_events add constraint airdrop_events_kind_check
check (kind in ('material_delta','material_set','tool_set','stage_set','build_reset'));
