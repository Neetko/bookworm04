-- Canonical titles + read-gating + discussions/reviews keyed to title

create table if not exists titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  description text,
  cover_image_url text,
  published_year integer,
  isbn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user read marker (spoiler gate)
create table if not exists title_reads (
  user_profile_id uuid not null references user_profiles(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_profile_id, title_id)
);

-- External source mapping (Google volume id -> canonical title)
create table if not exists title_sources (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title_id uuid not null references titles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists title_sources_source_external_id_unique
  on title_sources(source, external_id);

-- Attach canonical titles to library books + tracked books (optional but helps transitions)
alter table books add column if not exists title_id uuid;
alter table tracked_books add column if not exists title_id uuid;

-- Backfill: library books become canonical titles with same id
insert into titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select b.id, b.title, b.author, b.description, b.cover_image_url, b.published_year, b.isbn, b.created_at, b.updated_at
from books b
on conflict (id) do nothing;

update books set title_id = id where title_id is null;

-- Backfill: tracked books become canonical titles with same id (we may later unify to a library title by ISBN/title+author)
insert into titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select tb.id, tb.title, tb.author, tb.description, tb.cover_image_url, tb.published_year, tb.isbn, tb.created_at, tb.updated_at
from tracked_books tb
on conflict (id) do nothing;

update tracked_books set title_id = id where title_id is null;

-- Prefer unifying tracked titles onto existing library titles when possible
-- 1) ISBN match
update tracked_books tb
set title_id = b.id
from books b
where tb.title_id = tb.id
  and tb.isbn is not null
  and b.isbn = tb.isbn;

-- 2) Title+author match (case-insensitive)
update tracked_books tb
set title_id = b.id
from books b
where tb.title_id = tb.id
  and lower(b.title) = lower(tb.title)
  and lower(b.author) = lower(tb.author);

-- Migrate existing Google mappings from external_books -> title_sources
insert into title_sources (source, external_id, title_id)
select eb.source, eb.external_id, tb.title_id
from external_books eb
join tracked_books tb on tb.id = eb.tracked_book_id
on conflict (source, external_id) do nothing;

-- Backfill read markers from existing progress tables
insert into title_reads (user_profile_id, title_id)
select up.user_profile_id, up.book_id
from user_progress up
where up.is_completed = true
on conflict do nothing;

insert into title_reads (user_profile_id, title_id)
select tup.user_profile_id, tb.title_id
from tracked_user_progress tup
join tracked_books tb on tb.id = tup.tracked_book_id
where tup.is_completed = true
on conflict do nothing;

-- Reviews: add title_id and backfill from book_id
alter table reviews add column if not exists title_id uuid references titles(id) on delete cascade;
update reviews set title_id = book_id where title_id is null and book_id is not null;
create unique index if not exists reviews_user_title_unique on reviews(user_id, title_id);

-- Discussion posts: migrate from book_id to title_id
alter table discussion_posts add column if not exists title_id uuid references titles(id) on delete cascade;
update discussion_posts set title_id = book_id where title_id is null;

-- Allow discussion posts to exist without a library book_id
alter table discussion_posts alter column book_id drop not null;

-- Enforce title_id presence
alter table discussion_posts alter column title_id set not null;
