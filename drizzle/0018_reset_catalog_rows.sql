-- Clean slate for titles/books/tracked ingestion data (rows only)

begin;

-- Tracked/ingested metadata
delete from tracked_user_progress;
delete from external_books;
delete from tracked_books;

-- Title mappings and read gates
delete from title_sources;
delete from title_reads;

-- Title-linked community content
delete from club_reading_comments;
delete from discussion_posts;
delete from reviews;

-- Club reading selections and library interactions
delete from club_reading_items;
delete from bookmarks;
delete from favorites;
delete from user_progress;
delete from book_contents;

-- Library and canonical titles
delete from books;
delete from titles;

commit;
