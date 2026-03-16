create table if not exists public.user_genre_points (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  title_id uuid references public.titles(id) on delete set null,
  genre text not null,
  points integer not null,
  source_type text not null,
  source_id uuid not null,
  reason text not null,
  created_at timestamptz default now()
);

create unique index if not exists user_genre_points_user_source_genre_reason_unique
  on public.user_genre_points(user_profile_id, source_type, source_id, genre, reason);
