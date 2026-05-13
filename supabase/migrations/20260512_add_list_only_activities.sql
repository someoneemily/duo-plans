-- Activities created directly within a shared list (not visible in personal plans tab)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_list_only boolean DEFAULT false NOT NULL;
