CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "title_id" uuid REFERENCES "titles"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "activity_events"
  DROP CONSTRAINT IF EXISTS "activity_events_event_type_check";

ALTER TABLE "activity_events"
  ADD CONSTRAINT "activity_events_event_type_check"
  CHECK (event_type IN (
    'review_posted',
    'title_finished',
    'list_created',
    'list_item_added',
    'club_created',
    'club_joined',
    'achievement_earned'
  ));
