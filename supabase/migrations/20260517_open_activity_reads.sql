-- Deeplinks must always render. Privacy (solo vs public) is enforced in the UI,
-- not the DB — the explore queries already filter is_open=true at the query level.
-- UUIDs are unguessable so open reads are safe.
DROP POLICY IF EXISTS "Public activities viewable by everyone" ON public.activities;
DROP POLICY IF EXISTS "Activities viewable by owner or if open or completed" ON public.activities;

CREATE POLICY "Anyone can read any activity by id"
  ON public.activities FOR SELECT
  USING (true);
