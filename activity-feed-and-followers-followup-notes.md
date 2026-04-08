# Branch Notes: activity-feed-and-followers (follow-up)

## Summary
This follow-up covers message system wiring, activity event emission for real user actions, profile routing moved to user_profiles.id, and fixes for club planned reading insert failures. It also addresses nested button issues in message rows and ensures delete dialog interactions don’t open drafts.

## File-by-file notes

- [app/actions/reviews.ts](app/actions/reviews.ts)
  - Emits review activity events with title metadata and a plain-text review snippet.
  - Updates existing review activity when a review is edited to avoid duplicate feed entries.
  - Adds user profile ids to review profile mapping for id-based profile links.

- [app/actions/track-reading.ts](app/actions/track-reading.ts)
  - Emits title_finished activity events when a title is first marked as read.

- [app/actions/lists.ts](app/actions/lists.ts)
  - Emits list_created events for new custom lists.
  - Emits list_item_added events for custom list additions; skips duplicates on re-add.

- [app/actions/clubs.ts](app/actions/clubs.ts)
  - Emits club_created and club_joined activity events with club metadata.
  - Avoids writing invalid title_id values when adding planned reading items.

- [app/page.tsx](app/page.tsx)
  - Activity feed profile links now use user_profiles.id instead of username.

- [app/users/[username]/page.tsx](app/users/[username]/page.tsx)
  - Profile lookup now uses the route param as user_profiles.id (id-based routing).

- [components/title-engagement-tabs.tsx](components/title-engagement-tabs.tsx)
  - Review author links now use user_profiles.id; falls back to username display.

- [app/community/clubs/[id]/page.tsx](app/community/clubs/[id]/page.tsx)
  - Club member links now use user_profiles.id for profile navigation.

- [components/club-title-search.tsx](components/club-title-search.tsx)
  - Local planned-reading selections now send title ids (not book ids).

- [components/community-header.tsx](components/community-header.tsx)
  - Club creation planned-reading uses title ids for local items.

- [components/messages/message-list.tsx](components/messages/message-list.tsx)
  - Reworked message rows to be non-button containers with row-level navigation.
  - Delete dialog interactions stop event propagation to avoid opening drafts.
  - Added keyboard activation (Enter/Space) for row navigation.

- [app/messages/page.tsx](app/messages/page.tsx)
  - New messages page wiring: folder loading, draft handling, and delete integration.

- [app/messages/[id]/page.tsx](app/messages/[id]/page.tsx)
  - New detail view for messages with reply and draft save flows.

- [components/messages/message-detail.tsx](components/messages/message-detail.tsx)
  - New message detail UI with reply composer and draft save action.

- [components/messages/message-sidebar.tsx](components/messages/message-sidebar.tsx)
  - New sidebar navigation with folder counts.

- [app/api/messages/route.ts](app/api/messages/route.ts)
  - Message list and create endpoints with folder filtering and counts.

- [app/api/messages/[id]/route.ts](app/api/messages/[id]/route.ts)
  - Message detail, read update, edit, and delete with draft hard-delete and dual soft-delete for sent/inbox.

- [app/api/messages/recipients/route.ts](app/api/messages/recipients/route.ts)
  - Recipient suggestions based on mutual follow and recent profiles.

- [lib/messages.ts](lib/messages.ts)
  - Message type model for inbox/sent/draft handling.

- [drizzle/0031_messages.sql](drizzle/0031_messages.sql)
  - Initial messages table migration.

- [drizzle/0032_messages_delete_flags.sql](drizzle/0032_messages_delete_flags.sql)
  - Adds sender_deleted and recipient_deleted flags for soft delete.

- [supabase/migrations/20260407000000_messages.sql](supabase/migrations/20260407000000_messages.sql)
  - Supabase migration for messages table.

- [supabase/migrations/20260407000001_messages_delete_flags.sql](supabase/migrations/20260407000001_messages_delete_flags.sql)
  - Supabase migration for delete flags.

## Notes / follow-ups
- Profile route uses /users/{profileId}; ensure external links are updated if any still point to username-based URLs.
- Club planned reading uses title ids for local results; google results ingest into titles first.
- Activity feed remains follow-only and excludes the current user’s own actions by design.
