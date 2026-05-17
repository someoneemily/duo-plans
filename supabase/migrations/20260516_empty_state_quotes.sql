CREATE TABLE empty_state_quotes (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL
);

ALTER TABLE empty_state_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON empty_state_quotes FOR SELECT TO public USING (true);

INSERT INTO empty_state_quotes (text) VALUES
  ('Let''s start filling up your bucket list items.'),
  ('Great adventures start with a single plan.'),
  ('What''s next on your list of unforgettable moments?'),
  ('Every memorable experience starts here.'),
  ('Make plans. Make memories.'),
  ('Your next favorite memory is just a plan away.'),
  ('The best stories start with a yes.'),
  ('Turn your maybe someday into next weekend.'),
  ('A blank list is just a blank page for your next chapter.'),
  ('Life''s too short for an empty calendar.');
