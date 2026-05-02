-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Activities
create table if not exists public.activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text not null,
  notes text,
  is_open boolean default true not null,
  google_place_id text,
  created_at timestamptz default now()
);

alter table public.activities enable row level security;

create policy "Activities are viewable by everyone when open"
  on public.activities for select
  using (is_open = true or auth.uid() = user_id);

create policy "Users can insert their own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own activities"
  on public.activities for update
  using (auth.uid() = user_id);

create policy "Users can delete their own activities"
  on public.activities for delete
  using (auth.uid() = user_id);


-- Matches (created when two users are open on the same activity)
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  activity_name text not null,
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  activity1_id uuid references public.activities(id) on delete cascade not null,
  activity2_id uuid references public.activities(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (activity1_id, activity2_id)
);

alter table public.matches enable row level security;

create policy "Users can view their own matches"
  on public.matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);


-- Function: find and create matches when an activity is opened
create or replace function public.find_matches(p_activity_id uuid)
returns void as $$
declare
  v_activity public.activities;
  v_other public.activities;
begin
  select * into v_activity from public.activities where id = p_activity_id;

  if not v_activity.is_open then
    return;
  end if;

  for v_other in
    select * from public.activities
    where lower(name) = lower(v_activity.name)
      and is_open = true
      and user_id != v_activity.user_id
      and id != p_activity_id
  loop
    insert into public.matches (activity_name, user1_id, user2_id, activity1_id, activity2_id)
    values (v_activity.name, v_activity.user_id, v_other.user_id, p_activity_id, v_other.id)
    on conflict (activity1_id, activity2_id) do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- Trigger: run match-finding whenever an activity is inserted or updated
create or replace function public.trigger_find_matches()
returns trigger as $$
begin
  perform public.find_matches(new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_activity_upsert
  after insert or update of is_open, name on public.activities
  for each row execute procedure public.trigger_find_matches();
