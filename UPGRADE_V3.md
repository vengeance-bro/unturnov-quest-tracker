# Unturnov v3 upgrade (safe migration)

The live URL stays: https://vengeance-bro.github.io/unturnov-quest-tracker/

The improved version is staged at:
https://vengeance-bro.github.io/unturnov-quest-tracker/preview-v3.html

**Do not use the staged site for live progress until the Supabase SQL migration is done.**

## Step 1: Back up current progress

Ask Nolan, Tyler and Kalob to stop editing temporarily. On the OLD live website, open each player tab and use **Quest data & backups > Download backup** to save JSON copies of all three profiles. Keep those files.

## Step 2: Upgrade Supabase

1. Open Supabase Dashboard > Project > SQL Editor.
2. Open [supabase_v3_migration.sql](supabase_v3_migration.sql).
3. Paste the SQL and run it while no one is making quest changes.
4. This is an additive migration: it creates quest_events and imports existing quest_profiles JSON records. It does NOT delete or overwrite the old table, and it does not contain email addresses or passwords.
5. Confirm the migration with:
   ```sql
   select player, count(*) as migrated_quests
   from public.quest_events
   where kind='quest_created'
   group by player
   order by player;
   ```
6. Check that the counts match your previously saved quests. A player whose old profile was empty will show zero rows: stop and reconcile the backup before launching v3.

## Step 3: Preview and test

Visit https://vengeance-bro.github.io/unturnov-quest-tracker/preview-v3.html and refresh.

- Sign in with your existing Supabase account in **Account & cloud**.
- Your previous Supabase project URL, publishable key and saved login should carry across from the existing website in the same browser.
- Check all three profiles and existing progress; save one harmless test note, and observe **Pending updates** return to **0** and **Cloud synchronized**.
- Open in a different browser, sign in, check that the note appears there.
- Test increasing a goal once from each browser and verify the result counts both increases.
- Use **Recently deleted** / Restore and Undo to test recovery.

## Step 4: Switch the normal website

After verifying the preview, ask ChatGPT to publish the contents of preview-v3.html as index.html in the same GitHub repository. The original URL remains unchanged. No domain change is necessary.

## Changes

1. Per-action append-only database events instead of whole-profile overwrites. Separate simultaneous item count increments merge instead of replacing one another.
2. Persistent offline queue, retry, exportable three-player backups, undo and soft deletion, permanent server-side event history.
3. Removed the old screenshot import buttons and old account setup clutter. Credentials stay browser-side; Supabase Row Level Security still enforces the three approved users.
4. Active, Completed, All and Recently deleted filters.
5. Combined loot needed by Nolan, Tyler and Kalob, including Bundle of Dogtags = 10.
6. Pin quests and add shared quest notes / locations.

## Important limitations

- Simultaneously editing the same quest **metadata** (name/trader/goals) still uses last-change-wins, even though individual progress adjustments are safely replayed.
- No internet means local updates are queued on that browser until it reconnects; a different browser cannot see them until uploaded.
- No hosted app can guarantee that users never clear their browser data before pending changes upload. Export backups after significant sessions.
- Supabase plan-level database backups should be configured independently where available; the event history and full JSON export provide additional recovery options.
- The migration leaves the old quest_profiles table untouched for rollback. The new interface does not update that old table.
