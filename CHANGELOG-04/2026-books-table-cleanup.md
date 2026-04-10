# 2026-04-10 — Books table cleanup + activity feed polish

## Summary
- Removed remaining runtime usage of the legacy `books` table across reading, clubs, and title flows in favor of `titles` and `tracked_books`.
- Added migrations to drop legacy `books`-related columns/tables now that titles are canonical.
- Polished the home activity feed with clickable title/cover links and tuned cover sizing/padding.

## Changes
### Books table removal
- Eliminated `books` queries in diary, title, clubs, and track-reading actions; aligned progress tracking with `tracked_books` and `title_list_items`.
- Redirected legacy library/reader routes to title pages.
- Removed `books`-based types and legacy read-status actions.
- Removed `favorites` count from profile stats and dropped the table from schema.
- Deprecated legacy SQL/seed scripts related to `books`, `book_contents`, and `library_user_progress`.

### Activity feed UI
- Made activity feed title text and cover images link to the title page.
- Increased cover size and reduced card padding for better visual balance.
- Suppressed cover slot for list-creation events.

## Migrations
- Added Drizzle migration to drop legacy `books` table and dependent columns/tables.
- Added Supabase migration to drop legacy `books` table and dependent columns/tables.

## Files touched (high level)
- app/actions/* (track-reading, clubs, rewards, reviews, search-titles, profile)
- app/diary/*, app/titles/[id]/page.tsx, app/library/page.tsx, app/books/[id]/read/page.tsx
- components/* (navigation, diary-entry-dialog, title-track-progress-button, book-grid)
- db/schema.ts
- drizzle/0034_drop_books.sql
- supabase/migrations/20260410000000_drop_books.sql
- scripts/* (deprecated legacy book scripts)
- app/page.tsx (activity feed)
