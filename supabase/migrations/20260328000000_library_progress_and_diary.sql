ALTER TABLE IF EXISTS "user_progress" RENAME TO "library_user_progress";
ALTER INDEX IF EXISTS "user_progress_user_book_unique" RENAME TO "library_user_progress_user_book_unique";

CREATE TABLE IF NOT EXISTS "reading_diary_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE CASCADE,
  "book_id" uuid REFERENCES "books"("id") ON DELETE SET NULL,
  "tracked_book_id" uuid REFERENCES "tracked_books"("id") ON DELETE SET NULL,
  "entry_date" date NOT NULL DEFAULT CURRENT_DATE,
  "note_html" text,
  "note_text" text,
  "progress_mode" text NOT NULL,
  "current_page" integer,
  "total_pages" integer,
  "minutes_listened" integer,
  "total_minutes" integer,
  "progress_percent" integer,
  "is_completed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);
