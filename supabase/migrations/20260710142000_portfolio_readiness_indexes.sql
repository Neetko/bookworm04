-- Minimal current hot-path support for canonical ISBN lookup.
-- Defer trigram, GIN, feed, and dashboard indexes until query volume and
-- EXPLAIN plans show they are worth the write/storage cost.
create index if not exists titles_isbn_idx
  on public.titles (isbn);
