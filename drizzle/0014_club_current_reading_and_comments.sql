alter table clubs
add column if not exists current_title_id uuid references titles(id) on delete set null;

create table if not exists club_reading_comments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  content text not null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);
