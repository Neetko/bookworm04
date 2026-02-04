alter table if exists public.clubs
add column if not exists current_title_id uuid references public.titles(id) on delete set null;

create table if not exists public.club_reading_comments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);
