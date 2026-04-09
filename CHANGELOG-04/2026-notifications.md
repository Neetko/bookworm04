# April 2026 – Branch Change Log (activity-feed-and-followers)

## Overview
This branch adds a first-pass notifications system and related engagement mechanics (likes, bookmarks, and follow/friend events). It introduces notification APIs and UI, integrates unread counters into the navbar, adds review/discussion like interactions, and provides title bookmarking for discussion updates.

## Highlights
- Notification center with unread counters for messages + notifications.
- Follow and friendship notifications, plus like-based notifications for reviews and discussion posts.
- Title bookmarking to receive new discussion post alerts.
- Review and discussion like buttons with server-side toggles.
- New migrations for notifications, review likes, and title bookmarks.

## File-by-file notes

### App actions
- app/actions/title.ts
  - Adds discussion post like toggles and bookmark notifications.
  - Adds title bookmark actions and viewer-like state for posts.
- app/actions/reviews.ts
  - Adds review likes data and toggle handler.
  - Emits notifications when reviews are liked.
- app/actions/follow.ts
  - Emits follow and friendship notifications.
- app/actions/profile.ts
  - Removes deprecated bookmark count from profile stats.

### API routes
- app/api/notifications/route.ts
  - Fetches notifications and supports mark-as-read.
- app/api/notifications/counts/route.ts
  - Provides unread counts for notifications and messages.

### App routes/UI
- app/notifications/page.tsx
  - Notification inbox with mark-all-read.
- app/titles/[id]/page.tsx
  - Adds title bookmark CTA and normalizes genre fallback typing.

### Components
- components/navigation.tsx
  - Adds avatar badge and per-item counters for unread messages/notifications.
- components/title-engagement-tabs.tsx
  - Adds review like button.
- components/discussion-post.tsx
  - Adds discussion post like button.
- components/title-bookmark-button.tsx
  - Adds bookmark toggle UI for titles.

### Libraries
- lib/auth-provider.tsx
  - Redirects to home on sign-out.
- lib/types.ts
  - Removes deprecated bookmark type.

### Database schema + migrations
- db/schema.ts
  - Adds notifications, review likes, and title bookmarks; removes old bookmarks table.
- drizzle/0033_notifications_and_bookmarks.sql
- supabase/migrations/20260409000000_notifications_and_bookmarks.sql

### Copy updates
- app/about/page.tsx
  - Removes deprecated bookmark mention.
