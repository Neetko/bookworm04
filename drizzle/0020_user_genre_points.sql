CREATE TABLE IF NOT EXISTS "user_genre_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "title_id" uuid REFERENCES "titles"("id") ON DELETE SET NULL,
  "genre" text NOT NULL,
  "points" integer NOT NULL,
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_genre_points_user_source_genre_reason_unique"
  ON "user_genre_points" ("user_profile_id", "source_type", "source_id", "genre", "reason");
