-- Rename existing 'Restaurant' values before converting to enum
UPDATE activities SET category = 'Food' WHERE category = 'Restaurant';

-- Create the enum type
CREATE TYPE activity_category AS ENUM ('Food', 'Experience', 'Travel', 'Other');

-- Convert the column
ALTER TABLE activities
  ALTER COLUMN category TYPE activity_category
  USING category::activity_category;
