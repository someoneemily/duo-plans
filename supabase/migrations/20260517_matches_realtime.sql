-- Enable Realtime for the matches table so Postgres Changes subscriptions work.
-- Safe to skip if already added (check Dashboard > Database > Publications > supabase_realtime).
alter publication supabase_realtime add table public.matches;
