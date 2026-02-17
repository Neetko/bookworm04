-- Cleanup orphaned mappings after enforcing title/tracked_book constraints

delete from title_sources
where title_id is null
   or title_id not in (select id from titles);

delete from external_books
where tracked_book_id is null
   or tracked_book_id not in (select id from tracked_books);
