-- Add format check constraint to username (our handle field)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9_]{3,20}$');

-- Backfill existing users: snake_case of display_name, deduped with numeric suffix
DO $$
DECLARE
  r        RECORD;
  base     text;
  candidate text;
  suffix   int;
BEGIN
  FOR r IN
    SELECT id, display_name
    FROM public.profiles
    WHERE username IS NULL AND display_name IS NOT NULL
    ORDER BY created_at
  LOOP
    base := lower(regexp_replace(trim(r.display_name), '[^a-zA-Z0-9]+', '_', 'g'));
    base := btrim(base, '_');
    base := left(base, 20);
    IF length(base) < 3 THEN base := rpad(base, 3, '_'); END IF;

    candidate := base;
    suffix    := 2;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
      candidate := left(base, 17) || '_' || suffix;
      suffix    := suffix + 1;
    END LOOP;

    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Update the trigger so new sign-ups (including Google OAuth) get an auto-handle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  raw_name  text;
  base      text;
  candidate text;
  suffix    int := 2;
BEGIN
  raw_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'user');

  base := lower(regexp_replace(trim(raw_name), '[^a-zA-Z0-9]+', '_', 'g'));
  base := btrim(base, '_');
  base := left(base, 20);
  IF length(base) < 3 THEN base := rpad(base, 3, '_'); END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    candidate := left(base, 17) || '_' || suffix;
    suffix    := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    candidate
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
