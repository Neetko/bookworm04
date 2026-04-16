-- Canonical titles + read-gating + discussions/reviews keyed to title

create table if not exists public.titles (
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

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  title_id uuid references public.titles(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.title_sources (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title_id uuid not null references public.titles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists title_sources_source_external_id_unique
  on public.title_sources(source, external_id);

alter table public.books add column if not exists title_id uuid;
alter table public.tracked_books add column if not exists title_id uuid;

insert into public.titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select b.id, b.title, b.author, b.description, b.cover_image_url, b.published_year, b.isbn, b.created_at, b.updated_at
from public.books b
on conflict (id) do nothing;

update public.books set title_id = id where title_id is null;

insert into public.titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select tb.id, tb.title, tb.author, tb.description, tb.cover_image_url, tb.published_year, tb.isbn, tb.created_at, tb.updated_at
from public.tracked_books tb
on conflict (id) do nothing;

update public.tracked_books set title_id = id where title_id is null;

update public.tracked_books tb
set title_id = b.id
from public.books b
where tb.title_id = tb.id
  and tb.isbn is not null
  and b.isbn = tb.isbn;

update public.tracked_books tb
set title_id = b.id
from public.books b
where tb.title_id = tb.id
  and lower(b.title) = lower(tb.title)
  and lower(b.author) = lower(tb.author);

-- external_books -> title_sources (if external_books exists)
do $$
begin
  if to_regclass('public.external_books') is not null then
    execute 'insert into public.title_sources (source, external_id, title_id)
      select eb.source, eb.external_id, tb.title_id
      from public.external_books eb
      join public.tracked_books tb on tb.id = eb.tracked_book_id
      on conflict (source, external_id) do nothing';
  end if;
end $$;

insert into public.activity_events (user_profile_id, title_id, event_type)
select up.user_profile_id, up.book_id, 'title_finished'
from public.user_progress up
where up.is_completed = true
;

insert into public.activity_events (user_profile_id, title_id, event_type)
select tup.user_profile_id, tb.title_id, 'title_finished'
from public.tracked_user_progress tup
join public.tracked_books tb on tb.id = tup.tracked_book_id
where tup.is_completed = true
;

alter table public.reviews add column if not exists title_id uuid references public.titles(id) on delete cascade;
update public.reviews set title_id = book_id where title_id is null and book_id is not null;
create unique index if not exists reviews_user_title_unique on public.reviews(user_id, title_id);

alter table public.discussion_posts add column if not exists title_id uuid references public.titles(id) on delete cascade;
update public.discussion_posts set title_id = book_id where title_id is null;

alter table public.discussion_posts alter column book_id drop not null;
alter table public.discussion_posts alter column title_id set not null;
