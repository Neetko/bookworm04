create table if not exists public.user_experience (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  total_experience integer not null default 0,
  level integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
