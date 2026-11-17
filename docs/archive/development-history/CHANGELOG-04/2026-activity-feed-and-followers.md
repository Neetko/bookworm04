# Activity feed + books table cleanup (April 2026)

## Summary
- Removed remaining dependencies on the legacy `books` table across actions, pages, components, types, and scripts, standardizing on `titles` + `tracked_books`.
- Added drop-books migrations and cleaned legacy schema/seed scripts tied to `books`, `book_contents`, and `library_user_progress`.
- Refined the home activity feed UI: titles and covers link to title pages, cover sizing tuned, and list-creation cards no longer show empty covers.

## Details
- Home feed
  - Made title text and cover images link to the title page.
  - Adjusted card spacing and cover dimensions for better balance.
  - Suppressed cover slot for list-creation events.
- Books table removal
  - Updated diary, track-reading, clubs, profile, search, and titles pages/actions to use `titles`/`tracked_books` only.
  - Removed book-specific actions/types and cleaned legacy book grid wiring.
  - Redirected legacy library/book-read routes to the titles flow.
- Database + scripts
  - Added migrations to drop `books` and related columns/tables.
  - Deprecated old SQL/bootstrap/seed scripts that created or referenced `books`.
