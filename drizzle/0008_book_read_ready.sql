-- Add read_ready flag to books, and ensure book_contents has at most one row per book.

ALTER TABLE IF EXISTS public.books
  ADD COLUMN IF NOT EXISTS read_ready boolean NOT NULL DEFAULT false;

-- Mark as read-ready only if we actually have non-empty content stored.
UPDATE public.books b
SET read_ready = true
WHERE EXISTS (
  SELECT 1
  FROM public.book_contents bc
  WHERE bc.book_id = b.id
    AND length(coalesce(bc.content, '')) > 0
);

CREATE UNIQUE INDEX IF NOT EXISTS book_contents_book_id_unique
  ON public.book_contents (book_id);
