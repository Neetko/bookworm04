-- Track Reading: separate tracked (ingested) titles from Library books

create table if not exists public.tracked_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  description text,
  cover_image_url text,
  genre text[],
  published_year integer,
  isbn text,
  created_at timestamptz not null default now()
);

alter table public.tracked_books
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tracked_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  tracked_book_id uuid not null references public.tracked_books(id) on delete cascade,
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

create unique index if not exists tracked_user_progress_user_book_unique
  on public.tracked_user_progress(user_profile_id, tracked_book_id);

-- Ensure external_books uses tracked_book_id (rename from book_id if needed).
alter table public.external_books add column if not exists tracked_book_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'external_books'
      and column_name = 'book_id'
  ) then
    execute 'update public.external_books set tracked_book_id = coalesce(tracked_book_id, book_id) where tracked_book_id is null';
  end if;
end $$;

alter table public.external_books drop constraint if exists external_books_book_id_fkey;
alter table public.external_books drop constraint if exists external_books_tracked_book_id_fkey;
alter table public.external_books
  add constraint external_books_tracked_book_id_fkey foreign key (tracked_book_id) references public.tracked_books(id) on delete cascade;
alter table public.external_books
  alter column tracked_book_id set not null;
alter table public.external_books drop column if exists book_id;

-- Migrate any previously ingested Google titles that were stored in books via external_books.
insert into public.tracked_books (id, title, author, description, cover_image_url, genre, published_year, isbn, created_at, updated_at)
select distinct on (b.id)
  b.id, b.title, b.author, b.description, b.cover_image_url, b.genre, b.published_year, b.isbn, b.created_at, b.updated_at
from public.books b
join public.external_books eb on eb.tracked_book_id = b.id
on conflict (id) do nothing;

-- Move per-user tracking progress for ingested titles out of user_progress.
insert into public.tracked_user_progress (
  user_profile_id,
  tracked_book_id,
  current_page,
  total_pages,
  minutes_listened,
  total_minutes,
  progress_percent,
  is_completed,
  last_read_at
)
select
  up.user_profile_id,
  up.book_id as tracked_book_id,
  up.current_page,
  up.total_pages,
  up.minutes_listened,
  up.total_minutes,
  up.progress_percent,
  up.is_completed,
  up.last_read_at
from public.user_progress up
where up.book_id in (select tracked_book_id from public.external_books)
on conflict (user_profile_id, tracked_book_id) do update set
  current_page = excluded.current_page,
  total_pages = excluded.total_pages,
  minutes_listened = excluded.minutes_listened,
  total_minutes = excluded.total_minutes,
  progress_percent = excluded.progress_percent,
  is_completed = excluded.is_completed,
  last_read_at = excluded.last_read_at;

delete from public.user_progress
where book_id in (select tracked_book_id from public.external_books);

-- Remove ingested titles from Library books.
delete from public.books
where id in (select tracked_book_id from public.external_books);
