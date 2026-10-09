# Unturnov Tracker shared synchronization setup

The tracker lives at https://vengeance-bro.github.io/unturnov-quest-tracker/.

## Supabase (required to make quests shared across browsers)

1. Create a Supabase project at https://supabase.com/dashboard and keep the project owner account secure.
2. In **Authentication > URL Configuration**, set **Site URL** to `https://vengeance-bro.github.io/unturnov-quest-tracker/` and add the same URL to the allowlisted redirect URLs. Email sign-in must be enabled under **Authentication > Providers**.
3. Open **SQL Editor**. Open [supabase_setup.sql](supabase_setup.sql), REPLACE all nine example email addresses with the three real sign-in email addresses, then run the SQL. All email comparisons must be exact.
4. In **Project Settings > API Keys**, copy only the **publishable** or legacy **anon** key (NEVER a secret or service_role key). Also copy **Project URL** from **Project Settings > API**.
5. On the tracker, open **Shared sync setup / sign-in**, paste the Supabase URL and publishable key, then save. Have each friend do the same on their own browser.
6. Each friend enters their allowlisted email and clicks **Email sign-in link**. Open the email link in the same browser and on the same GitHub Pages site.
7. **First-time data setup:** Make a backup of Nolan's existing local quests and progress before connecting. Nolan should be the FIRST person to click **Sync now** while the online table is empty. That uploads his local quests. Each player can then open the three tabs and see the shared data.
8. Updates save locally immediately, upload after a short pause, and refresh from the shared database about every 12 seconds.

## Important behaviors and limitations

- Access is controlled by Supabase authentication plus Row Level Security; sharing the website URL alone cannot grant database access.
- Each of the three signed-in accounts can edit ANY of the Nolan, Tyler or Kalob tabs. The tabs separate tracking data, not editing permissions.
- One full JSON document is written per player; when two people edit the SAME player's tab at once, the last write may overwrite the earlier edit. Avoid simultaneous editing in the same player tab until finer-grained conflict handling is added.
- Quest progress saved before database setup remains in the browser. Do not import a backup into the wrong player's tab.
- Sign-in credentials stay in browser local storage; on shared/public devices use **Sign out**.
- Exports download only the currently selected player's tab.
- The site is a frontend only and does not create Supabase projects or tables automatically. GitHub Pages cannot serve as the writable shared database.
