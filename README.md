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

Prerequisites: Node.js 22, pnpm 10, Docker with its daemon running, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Local sign-up uses email/password; no Google Cloud project or OAuth credentials are needed.

1. Install dependencies from the lockfile:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Start the local Supabase stack and apply the migrations and showcase fixtures:

   ```bash
   supabase start
   supabase db reset --local
   ```

   `supabase/seed.sql` creates 30 tagged titles, five active community profiles, and one login-ready local demo reader with a populated feed. The committed cover files are resized WebP assets, so the catalog does not make 30 live cover requests. `db reset --local` deletes **local** database data before replaying migrations and this seed; never pass a remote target for this workflow.

3. Copy the environment template and fill in the local keys printed by `supabase status -o env`:

   ```bash
   cp .env.example .env.local
   supabase status -o env
   ```

   Map `API_URL` to `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` to `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key server-side and out of Git. The template selects `NEXT_PUBLIC_AUTH_MODE=email` for local development. `DATABASE_URL` is only needed for Drizzle commands. `GOOGLE_BOOKS_API_KEY` is optional; without it, local catalog browsing and sign-up still work, while external searches have a lower unauthenticated API quota.

4. Run the app and open `http://localhost:3000`:

   ```bash
   pnpm dev
   ```

   For the populated reviewer experience, sign in with the local-only fixture account:

   ```text
   Email: demo@bookworm.test
   Password: BookwormDemo!2026
   ```

   You can also create a fresh account from Sign up. Local email confirmation is disabled in `supabase/config.toml`, so no email delivery service is needed; a successful sign-up goes directly to onboarding from any page. Onboarding requires a public username and at least one favorite genre before the optional reading-list and reader-suggestion steps. The local credentials above are disposable development fixtures and must never be used in a hosted environment.

   To rebuild the committed cover assets from their pinned Open Library cover records:

   ```bash
   pnpm demo:covers
   ```

5. Validate before shipping:

   ```bash
   pnpm lint
   pnpm exec tsc --noEmit
   pnpm test
   pnpm test:e2e:local
   pnpm build
   ```

   `test:e2e:local` resets only the local Supabase database before running the protected-journey browser and RLS suite. See [Critical journeys](docs/critical-journeys.md) for the behavior covered and the authorization layers involved.

### Hosted Google sign-in

Hosted deployments use Google sign-in by default (`NEXT_PUBLIC_AUTH_MODE=google`, or leave it unset). Each self-hosted deployment needs its own Supabase project and Google OAuth client configured with the Supabase callback URL, plus the app URL in Supabase's allowed redirect URLs. Follow the [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls). A Google consent screen left in testing mode or a missing redirect URL can prevent reviewers from signing in. Local email mode avoids those requirements for anyone cloning the repo; it does not alter the hosted Google flow.

For a hosted email/password demo, explicitly set `NEXT_PUBLIC_AUTH_MODE=email` at build time and enable email sign-up in that Supabase project's Auth settings. Configure email confirmation and delivery for that environment. Never publish a shared demo password or reuse the local service-role key.

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

## Discussion Access

Title discussions are visible in read-only mode to guests and readers who have not finished the title. Marking a title as read unlocks the composer. Posting is protected by both the server action and database row-level security, so hiding or changing the interface cannot bypass the read requirement.

Demo cover images are sourced from the [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) and committed as optimized local WebP assets.
