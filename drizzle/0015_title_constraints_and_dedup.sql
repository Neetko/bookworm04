-- Enforce canonical title links and data integrity

-- Backfill titles for library books missing title_id
insert into titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select b.id, b.title, b.author, b.description, b.cover_image_url, b.published_year, b.isbn, b.created_at, b.updated_at
from books b
where b.title_id is null
on conflict (id) do nothing;

update books set title_id = id where title_id is null;

-- Backfill titles for tracked books missing title_id
insert into titles (id, title, author, description, cover_image_url, published_year, isbn, created_at, updated_at)
select tb.id, tb.title, tb.author, tb.description, tb.cover_image_url, tb.published_year, tb.isbn, tb.created_at, tb.updated_at
from tracked_books tb
where tb.title_id is null
on conflict (id) do nothing;

update tracked_books set title_id = id where title_id is null;

-- Prefer unifying tracked titles onto existing library titles when possible
update tracked_books tb
set title_id = b.id
from books b
where tb.title_id = tb.id
  and tb.isbn is not null
  and b.isbn = tb.isbn;

update tracked_books tb
set title_id = b.id
from books b
where tb.title_id = tb.id
  and lower(b.title) = lower(tb.title)
  and lower(b.author) = lower(tb.author);

-- De-duplicate tracked_books by title_id (keep oldest, rewire references, delete the rest)
with ranked as (
  select id, title_id,
         row_number() over (partition by title_id order by created_at nulls last, id) as rn
  from tracked_books
  where title_id is not null
),
keepers as (
  select id, title_id from ranked where rn = 1
),
dupes as (
  select id, title_id from ranked where rn > 1
)
update external_books eb
set tracked_book_id = k.id
from dupes d
join keepers k on k.title_id = d.title_id
where eb.tracked_book_id = d.id;

with ranked as (
  select id, title_id,
         row_number() over (partition by title_id order by created_at nulls last, id) as rn
  from tracked_books
  where title_id is not null
),
keepers as (
  select id, title_id from ranked where rn = 1
),
dupes as (
  select id, title_id from ranked where rn > 1
)
update tracked_user_progress tup
set tracked_book_id = k.id
from dupes d
join keepers k on k.title_id = d.title_id
where tup.tracked_book_id = d.id;

with ranked as (
  select id, title_id,
         row_number() over (partition by title_id order by created_at nulls last, id) as rn
  from tracked_books
  where title_id is not null
),
dupes as (
  select id from ranked where rn > 1
)
delete from tracked_books
using dupes
where tracked_books.id = dupes.id;

-- Normalize reviews to use title_id only; delete invalid rows
update reviews set title_id = book_id where title_id is null and book_id is not null;
update reviews set book_id = null where title_id is not null and book_id is not null;

delete from reviews where book_id is null and title_id is null;

-- Ensure club reading items have at least one of book_id/title_id
update club_reading_items cri
set title_id = b.title_id
from books b
where cri.book_id = b.id and cri.title_id is null and b.title_id is not null;

update club_reading_items set title_id = book_id where title_id is null and book_id is not null;

delete from club_reading_items where book_id is null and title_id is null;

-- Constraints
alter table books drop constraint if exists books_title_id_fkey;
alter table books add constraint books_title_id_fkey foreign key (title_id) references titles(id) on delete cascade;
alter table books alter column title_id set not null;

alter table tracked_books drop constraint if exists tracked_books_title_id_fkey;
alter table tracked_books add constraint tracked_books_title_id_fkey foreign key (title_id) references titles(id) on delete cascade;
create unique index if not exists tracked_books_title_id_unique on tracked_books(title_id);

alter table reviews drop constraint if exists reviews_book_or_title_check;
alter table reviews add constraint reviews_book_or_title_check check ((book_id is null) <> (title_id is null));

alter table club_reading_items drop constraint if exists club_reading_items_book_or_title_check;
alter table club_reading_items add constraint club_reading_items_book_or_title_check check (book_id is not null or title_id is not null);
