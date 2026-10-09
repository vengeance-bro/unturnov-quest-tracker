-- Unturnov: Add Dakota as fourth independent quest profile and full editor.
-- Safe additive change: old quest events, Airdrop progress and existing 3 profiles untouched.
ALTER TABLE public.quest_profiles DROP CONSTRAINT IF EXISTS quest_profiles_player_check;
ALTER TABLE public.quest_profiles ADD CONSTRAINT quest_profiles_player_check
 CHECK (player IN ('Nolan','Tyler','Kalob','Dakota'));

ALTER TABLE public.quest_events DROP CONSTRAINT IF EXISTS quest_events_player_check;
ALTER TABLE public.quest_events ADD CONSTRAINT quest_events_player_check
 CHECK (player IN ('Nolan','Tyler','Kalob','Dakota'));

INSERT INTO public.quest_profiles(player,quests)
VALUES ('Dakota','[]'::jsonb)
ON CONFLICT (player) DO NOTHING;

-- Approved accounts may read and manage all four players' quest data.
ALTER POLICY "approved players can read" ON public.quest_profiles
 TO authenticated USING
 (lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
ALTER POLICY "approved players can insert" ON public.quest_profiles
 TO authenticated WITH CHECK
 (lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
ALTER POLICY "approved players can update" ON public.quest_profiles
 TO authenticated
 USING (lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'))
 WITH CHECK (lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));

DROP POLICY IF EXISTS "invited viewer may read quest profiles" ON public.quest_profiles;

-- Grant Dakota the same write permission as the three existing editors.
ALTER POLICY "approved group writes quest events" ON public.quest_events
 TO authenticated WITH CHECK (
 auth.uid() IS NOT NULL AND lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));

ALTER POLICY "approved group writes airdrop events" ON public.airdrop_events
 TO authenticated WITH CHECK (
 auth.uid() IS NOT NULL AND lower(auth.jwt()->>'email') IN
 ('nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'));
