CREATE TABLE IF NOT EXISTS "user_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "followed_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "is_private" boolean NOT NULL DEFAULT true,
  "is_friend" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_follows_follower_followed_check" CHECK (follower_profile_id <> followed_profile_id),
  CONSTRAINT "user_follows_unique_pair" UNIQUE (follower_profile_id, followed_profile_id)
);
