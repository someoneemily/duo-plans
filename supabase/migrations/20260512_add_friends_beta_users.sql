CREATE TABLE friends_beta_users (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY
);

ALTER TABLE friends_beta_users ENABLE ROW LEVEL SECURITY;

-- Users can only check their own row
CREATE POLICY "users can check own beta status"
  ON friends_beta_users FOR SELECT
  USING (user_id = auth.uid());
