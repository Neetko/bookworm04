ALTER TABLE "titles"
  ADD COLUMN IF NOT EXISTS "dupe_work_ids" jsonb;

ALTER TABLE "tracked_books"
  ADD COLUMN IF NOT EXISTS "dupe_work_ids" jsonb;

ALTER TABLE "editions"
  ADD COLUMN IF NOT EXISTS "asin" text;
