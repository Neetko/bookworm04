ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "genre_weights" jsonb;
ALTER TABLE "titles" ADD COLUMN IF NOT EXISTS "genre_weights" jsonb;
ALTER TABLE "tracked_books" ADD COLUMN IF NOT EXISTS "genre_weights" jsonb;
