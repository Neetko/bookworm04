# user-lists — Change Log

Date: 2026-03-27
Branch: user-lists
Author: GitHub Copilot

## Overview
This branch reworks reading status and list management. Finished Reading is now a first-class default list in `title_lists`, and `title_list_items` becomes the single source of truth for read state. The ingest dialog was simplified to skip progress tracking and jump directly into dedupe + genre tagging after loading suggestions. The legacy `title_reads` table is repurposed as `activity_events` for future activity feed work.

## Key Behavior Changes
- Finished Reading is a default list (`list_type = finished-reading`) and drives read gating, stats, and UI.
- Read status is now list membership in `title_list_items`, not `title_reads`.
- Ingest no longer asks for progress; it loads suggestions and proceeds directly to dedupe + tags.
- Edit Lists now supports internal+external search, genre filters for internal-only, and cross-default-list move prompts.

## Per-File Notes

### Server Actions & Data
- app/actions/profile.ts
  - Ensures default lists (Planned, Current, Finished), returns list IDs and list items.
  - Computes `booksRead` from Finished list items instead of `title_reads`.
  - Replaces `readTitles` with `finishedReadingTitles` in payload.

- app/actions/title.ts
  - `getTitleReadStatus` and `setTitleReadStatus` now use Finished list membership.
  - Gated content (discussion/reviews) now checks Finished list.
  - Ensures Planned/Current/Finished lists, and removes titles from Planned/Current when marking read.

- app/actions/reviews.ts
  - Review permission gate switched from `title_reads` to Finished list items.
  - Ensures Finished list exists when gating.

- app/actions/track-reading.ts
  - Ingest no longer tracks progress on confirmation.
  - Read completion now adds to Finished list items and removes from Planned/Current.
  - Progress tracking updates now adjust Planned/Current list membership.

- app/actions/lists.ts
  - Added ensure helpers for Planned, Current, and Finished lists.
  - List fetch ensures default lists exist before returning summaries.

### UI
- app/profile/page.tsx
  - Profile now renders Planned/Current/Finished tabs plus custom lists.
  - Uses Finished list items for "Books Read" display.

- app/profile/edit-lists/page.tsx
  - Full edit support for Finished Reading list (add/remove via list items).
  - Dialog shows active list name, supports internal-only genre filters, and external toggle.
  - Results are filtered to exclude titles already in the current list.
  - Adds move prompt when adding to default list that already contains title in another default list.

- app/users/[username]/page.tsx
  - Public read list now resolves via Finished list items.

- components/track-reading-result-list.tsx
  - Ingest dialog no longer collects progress; shows loading status until suggestions arrive.
  - Open Library matches list compacted; always shows all candidates within fixed height.
  - Added optional action button support for list additions.

### Database / Migrations
- db/schema.ts
  - `title_reads` replaced with `activity_events` schema.
  - Added `title_lists`, `title_list_items`, and `title_list_likes` schemas.

- drizzle/0012_titles_and_gating.sql
  - `title_reads` replaced with `activity_events`.
  - Backfill now creates activity events from completed progress.

- drizzle/0018_reset_catalog_rows.sql
  - Reset now clears `activity_events` and `title_list_items`.

- drizzle/0024_title_lists.sql
  - New list tables and indexes.

- drizzle/0025_activity_events_finished_list.sql
  - Backfill Finished Reading list items from activity events.

- supabase/migrations/20260130020000_titles_and_gating.sql
  - Mirrors `activity_events` changes and backfill updates.

- supabase/migrations/20260317000000_title_lists.sql
  - New list tables and indexes.

## Data Migration Notes
- Finished Reading list items are backfilled from `activity_events` for `event_type = title_read`.
- `title_reads` is no longer used; keep `activity_events` for future activity feed.

## Risk / Follow-up
- If any external integrations still write to `title_reads`, they must be migrated to `activity_events`.
- Activity feed events are not yet written in all flows; this is a planned follow-up.
