-- Shared lists: top-level container, auto-named from members at render time
CREATE TABLE IF NOT EXISTS shared_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Members of a shared list (includes creator)
CREATE TABLE IF NOT EXISTS shared_list_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid REFERENCES shared_lists(id) ON DELETE CASCADE NOT NULL,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invited_by_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status        text CHECK (status IN ('pending','accepted','declined')) DEFAULT 'pending' NOT NULL,
  responded_at  timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE(list_id, user_id)
);

-- Activities pinned to a shared list (referenced, not moved from personal plans)
CREATE TABLE IF NOT EXISTS shared_list_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     uuid REFERENCES shared_lists(id) ON DELETE CASCADE NOT NULL,
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  added_by_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(list_id, activity_id)
);

-- RLS: shared_lists
ALTER TABLE shared_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view shared lists"
  ON shared_lists FOR SELECT
  USING (
    id IN (
      SELECT list_id FROM shared_list_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated users can create shared lists"
  ON shared_lists FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- RLS: shared_list_members
ALTER TABLE shared_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view list members"
  ON shared_list_members FOR SELECT
  USING (
    list_id IN (
      SELECT list_id FROM shared_list_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "creator can add members on creation"
  ON shared_list_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = invited_by_id
  );

CREATE POLICY "users can respond to their own invite"
  ON shared_list_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS: shared_list_activities
ALTER TABLE shared_list_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view list activities"
  ON shared_list_activities FOR SELECT
  USING (
    list_id IN (
      SELECT list_id FROM shared_list_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "accepted members can add activities"
  ON shared_list_activities FOR INSERT
  WITH CHECK (
    auth.uid() = added_by_id
    AND list_id IN (
      SELECT list_id FROM shared_list_members
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "adder can remove activities"
  ON shared_list_activities FOR DELETE
  USING (added_by_id = auth.uid());
