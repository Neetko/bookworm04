-- Drop legacy books table and related columns/tables now that titles are canonical.

-- Reviews no longer reference books.
alter table if exists reviews drop constraint if exists reviews_book_or_title_check;
alter table if exists reviews drop constraint if exists reviews_book_id_books_id_fk;
drop index if exists reviews_user_book_unique;
alter table if exists reviews drop column if exists book_id;

-- Club reading items no longer reference books.
alter table if exists club_reading_items drop constraint if exists club_reading_items_book_or_title_check;
alter table if exists club_reading_items drop constraint if exists club_reading_items_book_id_books_id_fk;
alter table if exists club_reading_items drop column if exists book_id;

-- Discussion posts no longer reference books.
alter table if exists discussion_posts drop constraint if exists discussion_posts_book_id_books_id_fk;
alter table if exists discussion_posts drop column if exists book_id;

-- Reading diary entries no longer reference books.
alter table if exists reading_diary_entries drop constraint if exists reading_diary_entries_book_id_books_id_fk;
alter table if exists reading_diary_entries drop column if exists book_id;

-- Drop legacy tables tied to books.
drop table if exists favorites;
drop table if exists library_user_progress;
drop table if exists book_contents;
drop table if exists books;
