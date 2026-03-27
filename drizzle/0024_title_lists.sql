CREATE TABLE IF NOT EXISTS "title_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "list_type" text NOT NULL DEFAULT 'custom',
  "is_public" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "title_lists_user_type_unique"
  ON "title_lists" ("user_profile_id", "list_type");

CREATE TABLE IF NOT EXISTS "title_list_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL REFERENCES "title_lists"("id") ON DELETE CASCADE,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "title_list_items_list_title_unique"
  ON "title_list_items" ("list_id", "title_id");

CREATE TABLE IF NOT EXISTS "title_list_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL REFERENCES "title_lists"("id") ON DELETE CASCADE,
  "user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "title_list_likes_user_list_unique"
  ON "title_list_likes" ("user_profile_id", "list_id");
