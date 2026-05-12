-- Fix infinite recursion in shared_list_members RLS policies.
-- The SELECT policies queried shared_list_members from within shared_list_members,
-- causing Postgres error 42P17. SECURITY DEFINER functions bypass RLS so the
-- subquery doesn't re-enter the policy being evaluated.

CREATE OR REPLACE FUNCTION auth_user_list_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT list_id FROM shared_list_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_accepted_list_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT list_id FROM shared_list_members
  WHERE user_id = auth.uid() AND status = 'accepted';
$$;

-- shared_lists SELECT: creator can always see their own list (needed for INSERT...RETURNING
-- before member rows exist), plus any user who is a member
DROP POLICY IF EXISTS "members can view shared lists" ON shared_lists;
CREATE POLICY "members can view shared lists"
  ON shared_lists FOR SELECT
  USING (
    creator_id = auth.uid()
    OR id IN (SELECT auth_user_list_ids())
  );

-- shared_list_members SELECT
DROP POLICY IF EXISTS "members can view list members" ON shared_list_members;
CREATE POLICY "members can view list members"
  ON shared_list_members FOR SELECT
  USING (list_id IN (SELECT auth_user_list_ids()));

-- shared_list_activities SELECT
DROP POLICY IF EXISTS "members can view list activities" ON shared_list_activities;
CREATE POLICY "members can view list activities"
  ON shared_list_activities FOR SELECT
  USING (list_id IN (SELECT auth_user_accepted_list_ids()));

-- shared_list_activities INSERT: accepted members or the list creator
DROP POLICY IF EXISTS "accepted members can add activities" ON shared_list_activities;
CREATE POLICY "accepted members can add activities"
  ON shared_list_activities FOR INSERT
  WITH CHECK (
    auth.uid() = added_by_id
    AND (
      list_id IN (SELECT auth_user_accepted_list_ids())
      OR list_id IN (SELECT id FROM shared_lists WHERE creator_id = auth.uid())
    )
  );
