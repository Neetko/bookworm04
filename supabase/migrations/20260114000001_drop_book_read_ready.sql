-- Drop read_ready flag from books; in-library presence implies read-ready.

ALTER TABLE IF EXISTS public.books
  DROP COLUMN IF EXISTS read_ready;
