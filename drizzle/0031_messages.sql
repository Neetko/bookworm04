CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sender_profile_id" uuid NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "recipient_profile_id" uuid REFERENCES "user_profiles"("id") ON DELETE SET NULL,
  "recipient_username" text,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'sent',
  "is_read" boolean NOT NULL DEFAULT false,
  "reply_to" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "messages_status_check" CHECK (status IN ('sent', 'draft'))
);

CREATE INDEX IF NOT EXISTS "messages_sender_profile_id_idx" ON "messages"("sender_profile_id");
CREATE INDEX IF NOT EXISTS "messages_recipient_profile_id_idx" ON "messages"("recipient_profile_id");
CREATE INDEX IF NOT EXISTS "messages_status_idx" ON "messages"("status");
