-- Remove tracked_books and migrate to titles

create table if not exists public.title_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  current_page integer not null default 0,
  total_pages integer,
  minutes_listened integer,
  total_minutes integer,
  progress_percent integer,
  is_completed boolean not null default false,
  last_read_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists title_user_progress_user_title_unique
  on public.title_user_progress(user_profile_id, title_id);

do $$
begin
  if to_regclass('public.tracked_user_progress') is not null and to_regclass('public.tracked_books') is not null then
    insert into public.title_user_progress (
      user_profile_id,
      title_id,
      current_page,
      total_pages,
      minutes_listened,
      total_minutes,
      progress_percent,
      is_completed,
      last_read_at
    )
    select
      tup.user_profile_id,
      tb.title_id,
      tup.current_page,
      tup.total_pages,
      tup.minutes_listened,
      tup.total_minutes,
      tup.progress_percent,
      tup.is_completed,
      tup.last_read_at
    from public.tracked_user_progress tup
    join public.tracked_books tb on tb.id = tup.tracked_book_id
    on conflict (user_profile_id, title_id) do update set
      current_page = excluded.current_page,
      total_pages = excluded.total_pages,
      minutes_listened = excluded.minutes_listened,
      total_minutes = excluded.total_minutes,
      progress_percent = excluded.progress_percent,
      is_completed = excluded.is_completed,
      last_read_at = excluded.last_read_at,
      updated_at = now();
  end if;
end $$;

do $$
begin
  if to_regclass('public.external_books') is not null and to_regclass('public.tracked_books') is not null then
    insert into public.title_sources (source, external_id, title_id)
    select eb.source, eb.external_id, tb.title_id
    from public.external_books eb
    join public.tracked_books tb on tb.id = eb.tracked_book_id
    on conflict (source, external_id) do nothing;
  end if;
end $$;

alter table public.reading_diary_entries drop column if exists tracked_book_id;

drop table if exists public.external_books;
drop table if exists public.tracked_user_progress;
drop table if exists public.tracked_books;
