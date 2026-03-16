CREATE TABLE IF NOT EXISTS "user_experience" (
  "user_profile_id" uuid PRIMARY KEY REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "total_experience" integer NOT NULL DEFAULT 0,
  "level" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
