# Suggestions, dedupe, pooled references, and cover workflow log

_Date: 2026-04-15_

## Overview
This branch reshapes title ingest, dedupe, admin review, and cover handling around a cleaner canonical-title model.

The main goals were:
- remove remaining dependencies on legacy `tracked_books`-style flows
- route title dedupe through admin review instead of mutating title data directly
- replace primary/dupe-centric suggestion persistence with pooled selected-work references
- suppress already-known external books by normalized identifiers instead of brittle source mappings
- add a reusable admin review workflow for work selection and cover selection
- warm and reuse Open Library cover assets early so approved covers are ready at review time
- stop rewriting stored cover URLs at render time so approved covers display consistently

## High-level product changes

### 1. Admin suggestion review became the canonical approval gate
The admin suggestions experience now supports a full review loop instead of acting like a thin moderation screen.

Implemented changes:
- pending suggestions are surfaced in a dedicated admin page
- review happens in a dialog instead of inline card sprawl
- admins save a separate final review state before approval
- approved and dismissed suggestions leave the pending queue immediately
- review state now includes:
  - final genres
  - final selected Open Library work ids
  - final selected work snapshots
  - final chosen cover

Practical impact:
- user input is preserved as submitted
- admin decisions are stored independently
- approval applies curated data intentionally rather than reusing raw user suggestion fields

## 2. Suggestion work matching moved to a probability-based model
Open Library matches are now bucketed instead of being treated as a single flat list.

Implemented buckets:
- exact title/author matches
  - auto-classified as duplicates
  - hidden from user/admin pickers where appropriate
- high-confidence near matches
  - stored as Bookworm/admin-facing suggestions
- lower-confidence matches
  - shown to users for optional review submission

This makes ingest less noisy and reduces redundant admin review.

## 3. Title dedupe now submits for review instead of writing immediately
The title-page dedupe dialog no longer writes work ids directly onto a title.

New behavior:
- dedupe candidates exclude already-linked work ids for the current title
- exact title/author matches are filtered out
- candidates already pending in review are shown but disabled
- candidates linked to other titles remain visible with warnings
- selected items are submitted as pending suggestions for admin review

This makes title dedupe consistent with the rest of the moderation workflow.

## 4. Canonical work/reference architecture shifted to pooled references
This branch continues the move away from using `titles.work_id` + `dupe_work_ids` as the main source of truth.

New canonical support tables:
- `title_reference_works`
- `reference_isbns`

What this changes:
- a title can accumulate reference work ids through pooled associations
- search suppression no longer relies on old external source mappings alone
- normalized identifier overlap is used to hide already-ingested external results
- legacy fallback columns still exist for compatibility, but runtime behavior prefers pooled reference data

## 5. Cover handling became reviewable, cacheable, and deterministic
Admin review no longer depends on a "fetch similar works" flow to choose artwork.

New behavior:
- admins can load cover choices for selected works
- Open Library covers are fetched and cached into the `book-covers` bucket
- cache metadata is stored in `work_cover_cache`
- Google thumbnail fallback is stored as a URL reference only
- final cover choice is saved on the suggestion review record
- approval applies the chosen cover to `titles.cover_image_url`
- cache warming happens during suggestion creation so review usually has cover options ready

## Database and schema changes

### New/expanded tables and enums
Added or formalized in schema and migrations:
- `app_role`
- `suggestion_status`
- `suggestion_match_type`
- `title_reference_works`
- `reference_isbns`
- `work_cover_cache`
- `suggestions`
- `suggestion_work_matches`
- `title_user_progress`

### Suggestion schema changes
Suggestions now persist:
- `suggested_selected_work_ids`
- `suggested_selected_work_snapshots`
- `admin_final_selected_work_ids`
- `admin_final_selected_work_snapshots`
- `admin_final_cover_selection`
- `admin_reviewed_at`
- `admin_reviewed_by_profile_id`

Legacy primary/dupe suggestion columns were backfilled and removed from active runtime usage.

### Legacy tracked-book cleanup
The branch removes more remaining reliance on:
- `tracked_books`
- `tracked_user_progress`
- `external_books`

Reading progress and diary flows now align around canonical titles via `title_user_progress`.

## Server action and data-flow changes

### Search and ingest
Search now:
- merges Google/Open Library identifiers more aggressively
- normalizes identifiers before suppression
- filters external results against `reference_isbns`
- stops treating external results as already-ingested via legacy claimed/source mapping logic

Ingest now:
- creates suggestions instead of directly overcommitting metadata decisions
- stores probabilistic work match records in `suggestion_work_matches`
- preserves work snapshots, including cover URLs
- warms cover choices during suggestion creation

### Title page actions
Title actions now:
- resolve editions through pooled title reference work ids
- submit title dedupe work ids as suggestions
- compute pending review work ids for disabled candidate states
- warn when selected work ids are already linked elsewhere

### Admin suggestion actions
Admin actions now support:
- proper role validation via `user_roles`
- saving a reviewed final state
- approval applying pooled work ids and reference isbns
- approval applying selected cover art
- loading cached or fetchable cover choices for selected works

## UI changes

### Admin review UI
Added/reworked:
- admin suggestions page
- suggestion review dialog/card
- reusable work selection cards
- reusable cover picker

Behavioral improvements:
- exact-match noise removed from admin review
- user-selected works render even when only ids are available
- cover selection is explicit and persisted

### Search titles UI
Updated behavior:
- internal dropdown suggestions are suppressed while an active search is already in progress
- external toggle refreshes the search state cleanly
- Google results no longer inherit local-title open states through old source mapping assumptions
- lower-confidence work candidates are labeled as review submissions instead of direct matches

### Title page and progress UI
Updated behavior:
- title progress tracking no longer depends on a tracked-book id
- title page cover rendering uses the stored `cover_image_url` as-is
- dedupe dialog messaging now reflects review-first moderation

### Diary UI
Updated behavior:
- diary title options and progress resolution now read from canonical title progress
- genre lookups stop falling back through removed tracked-book tables

## Important bug fixes included in this branch

### Admin access fix
Problem:
- admin review could fail even for valid admins

Fix:
- admin access now checks `user_roles` by auth user id via the admin client
- it no longer relies on community profile role fields

### Ambiguous suggestions relation fix
Problem:
- suggestions queries became ambiguous after adding another FK path to `user_profiles`

Fix:
- admin queries now use explicit FK-qualified embeds

### Exact-match filtering fix
Problem:
- exact Open Library matches still leaked into admin or title-dedupe flows

Fix:
- exact title/author matches are filtered in shared helper paths and submit-time guards

### Cover rendering fix
Problem:
- approved covers were persisted but failed to render in some views because stored URLs were rewritten from `http:` to `https:` at render time

Fix:
- title page cover rendering now uses stored URLs directly
- search result cover rendering now uses stored URLs directly

## Reviewer notes
- The branch is intentionally architectural, not just UI-level.
- The main theme is moving from legacy tracked/primary-dupe assumptions to canonical `titles` plus pooled reference metadata.
- Review should focus on:
  - suggestion persistence changes
  - approval semantics
  - identifier suppression behavior
  - title dedupe moderation flow
  - cover caching/fallback logic
  - tracked-book removal fallout across diary/progress/search

## Migration notes
Relevant migrations added in this branch include:
- `20260410010000_remove_tracked_books.sql`
- `20260410020000_suggestions_workflow.sql`
- `20260411090000_update_suggestions_policies.sql`
- `20260413120000_add_suggestion_metadata.sql`
- `20260413123000_suggestions_admin_review_fields.sql`
- `20260413130000_suggestion_work_matches.sql`
- `20260414110000_title_reference_works_and_isbns.sql`
- `20260414123000_suggestion_selected_work_fields.sql`
- `20260415110000_work_cover_cache_and_suggestion_cover_choice.sql`

There is also a disabled migration retained for reference/history around an earlier admin review timestamp conflict.

## Files and subsystems most affected
- admin suggestion page and review components
- suggestion server actions
- title dedupe server actions and dialog UI
- search titles server/client flow
- track reading ingest flow
- title page rendering and progress entry points
- diary pages and dialog
- Open Library and Google Books integration helpers
- reference-data and suggestion normalization helpers
- Drizzle schema and Supabase migrations

## Expected outcome after merge
After merge, title ingest and dedupe should behave as a moderated canonicalization pipeline:
- external titles are less likely to reappear once known identifiers are stored
- users can submit possible matches without directly mutating title metadata
- admins can review genres, work links, and covers in one place
- approved titles render the chosen cover consistently across title/search/diary surfaces
- progress and diary flows align with canonical titles instead of legacy tracked-book records
