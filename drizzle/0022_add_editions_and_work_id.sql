ALTER TABLE "titles"
  ADD COLUMN IF NOT EXISTS "work_id" text,
  ADD COLUMN IF NOT EXISTS "isbn_list" jsonb;

ALTER TABLE "tracked_books"
  ADD COLUMN IF NOT EXISTS "work_id" text,
  ADD COLUMN IF NOT EXISTS "isbn_list" jsonb;

CREATE TABLE IF NOT EXISTS "editions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_id" text NOT NULL,
  "isbn_10" text,
  "isbn_13" text,
  "volume_id" text,
  "format" text,
  "saleability" text,
  "raw_google_data" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "editions_isbn_13_unique" ON "editions" ("isbn_13");
CREATE UNIQUE INDEX IF NOT EXISTS "editions_isbn_10_unique" ON "editions" ("isbn_10");
CREATE UNIQUE INDEX IF NOT EXISTS "editions_volume_id_unique" ON "editions" ("volume_id");
CREATE INDEX IF NOT EXISTS "editions_work_id_index" ON "editions" ("work_id");
