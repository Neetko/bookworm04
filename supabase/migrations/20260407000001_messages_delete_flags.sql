ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "sender_deleted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recipient_deleted" boolean NOT NULL DEFAULT false;
