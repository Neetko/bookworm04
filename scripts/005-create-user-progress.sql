CREATE TABLE IF NOT EXISTS "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
	"book_id" uuid NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
	"current_page" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_progress_user_book_unique" UNIQUE("user_profile_id", "book_id")
);
