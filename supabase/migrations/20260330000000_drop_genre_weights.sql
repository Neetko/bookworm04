ALTER TABLE "books" DROP COLUMN IF EXISTS "genre_weights";
ALTER TABLE "titles" DROP COLUMN IF EXISTS "genre_weights";
ALTER TABLE "tracked_books" DROP COLUMN IF EXISTS "genre_weights";
