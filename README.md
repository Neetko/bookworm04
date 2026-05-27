# Bookworm

Bookworm is a Next.js + Supabase reading community app. The current product model is title-centric: canonical `titles` are the source of truth for reviews, discussions, reading progress, diary entries, lists, clubs, suggestions, and metadata approval.

## Stack

- Next.js 15 / React 19
- Supabase Auth, Postgres, Storage, and RLS
- Drizzle schema definitions in `db/schema.ts`
- Tailwind CSS and shadcn/Radix UI components
- TipTap for rich-text editing

## Current Data Model

The active catalog model is based on `titles`.

Important current tables:

- `titles`: canonical title records.
- `title_sources`: external source mappings such as Google volume ids.
- `title_reference_works`: pooled Open Library work references for a title.
- `reference_isbns`: normalized ISBN references used for suppression and matching.
- `title_lists` and `title_list_items`: planned/current/finished/custom reading lists. Finished list membership drives read-gated reviews and discussions.
- `title_user_progress` and `reading_diary_entries`: progress and diary state.
- `suggestions` and `suggestion_work_matches`: user/staff metadata review workflow.
- `clubs`, `club_members`, `club_applications`, `club_invitations`: club membership and moderation.
- `club_writer_works` and `club_writer_work_likes`: writer-club manuscript workflow.
- `notifications`, `messages`, `activity_events`, `user_follows`: social and inbox features.

Legacy concepts such as `books`, `book_contents`, `tracked_books`, `tracked_user_progress`, `library_user_progress`, and `title_reads` are historical migration context only. New runtime code should not depend on them.

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment variables:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATABASE_URL=
   ```

   Development has local fallback values for Supabase public config, but production fails fast when required Supabase variables are missing.

3. Run the app:

   ```bash
   pnpm dev
   ```

4. Validate before shipping:

   ```bash
   pnpm lint
   pnpm exec tsc --noEmit
   pnpm build
   ```

## Migrations

Supabase migrations in `supabase/migrations` are the deployment source for database changes. Drizzle migrations are retained for schema history and local workflow compatibility, but avoid adding new runtime dependencies on removed legacy tables.

When changing schema:

- update `db/schema.ts`
- add a Supabase migration
- keep RLS policies aligned with the application access model
- validate affected server actions under both user-scoped and service-role clients

## Server Architecture

Server actions should stay thin. Prefer this structure:

- `app/actions/*`: auth/session entry, action argument validation, cache revalidation, and return shape.
- `lib/server/*`: domain services for reusable business logic.
- `lib/*`: shared parsing, metadata, sanitization, and integration helpers.

Examples:

- `lib/server/auth.ts`: authenticated profile helpers.
- `lib/server/title-lists.ts`: default reading-list creation and list item moves.
- `lib/server/title-matching.ts`: canonical Google/source/ISBN/title matching for ingest.

This keeps Next.js framework plumbing separate from product rules and makes core logic easier to test.

## Ingest And Metadata Review

Google/Open Library ingest should prefer durable identifiers over fuzzy matching:

1. `title_sources` external id mapping.
2. `reference_isbns` pooled ISBN references.
3. `titles.isbn`.
4. `titles.isbn_list`.
5. exact title/author fallback.

Lower-confidence work matches should flow through suggestions and staff review instead of directly mutating canonical title metadata.

## RLS And Access

Application authorization uses `user_roles` for app-level roles. `user_profiles.role` is a public display label. Server code should use user-scoped Supabase clients for user-owned operations and service-role clients only for trusted operations that must bypass RLS, such as controlled notification writes or staff moderation workflows.
