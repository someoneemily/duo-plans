-- Allow anyone to read completed activities (needed for shared deeplinks to work).
-- Solo activities still require ownership. UUIDs are unguessable so this is safe.
DROP POLICY IF EXISTS "Public activities viewable by everyone" ON public.activities;

CREATE POLICY "Public activities viewable by everyone"
  ON public.activities FOR SELECT
  USING (is_open = true OR auth.uid() = user_id OR completed_at IS NOT NULL);
