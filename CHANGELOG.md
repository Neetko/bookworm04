# Changelog

## Unreleased

### Added
- Canonical titles data model and read gating for reviews/discussions.
- Title-centric search flow with unified results and suggestions API.
- Track Reading support for tracked books and progress tracking.
- Club current reading discussion with comments and upvotes.
- Club title search and planned reading enhancements.
- New profile read titles section and user read list page.
- Server-side avatar image resizing and cover image helper.
- Sanitized HTML rendering helper for descriptions.
- Community genre and type multi-select filters with AND matching.
- Club grid layout component.
- Supabase + Drizzle migrations for titles, tracked books, reads, sources, club reading comments, and related columns.

### Changed
- Book detail now redirects to canonical title route.
- Track Reading route redirects to Search Titles.
- Library and navigation links updated to use title routes.
- Reviews and discussions now keyed to titles (with read gating).
- Clubs list includes current reading and planned reading previews.
- Profile stats now compute read counts from title reads.
- Book seed script now seeds from titles and upserts contents.
- Google Books API handling is fail-soft with deduped results.
- Avatar uploads are resized server-side before storage.

### Fixed
- Title route mapping for library items and search results.
- Club planned reading list link resolution to titles.
- Community filter behavior (type/genre) and layout adjustments.

### Dependencies
- Added: sharp, sanitize-html, @types/sanitize-html.
