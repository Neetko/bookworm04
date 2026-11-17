# Bookworm development log

This is Bookworm's single maintained engineering history. It records the problem behind each major change, the decision taken, what was implemented, how it was checked, and the trade-off or follow-up left behind.

Older notes under `docs/archive/` are retained only as unmaintained source material. The former root changelog was removed because it mixed completed work with obsolete `/books`, `/library`, and tracked-book behavior. Current product and setup claims belong here and in the README.

## Product direction and engineering rules

Bookworm is a title-centric reading community. Canonical titles connect discovery, lists, progress, diary entries, reviews, discussions, social activity, clubs, notifications, and metadata suggestions.

The recurring engineering rule is defense in depth:

1. The interface presents the capability available to the current reader and explains locked actions.
2. Server actions authenticate the session, validate untrusted input, and enforce the product rule.
3. Postgres constraints, functions, and row-level security enforce the same boundary if a caller bypasses the interface.

The portfolio rule is equally strict: there is one maintained product. Demo-only differences are limited to local fixture data, fixture assets, and environment-specific authentication. Runtime fixes and features must work for both seeded and newly created readers and must be suitable for the hosted application.

---

## 1. Typed baseline and canonical title model — January to April 2026

### Problem

The inherited application mixed several identities for the same reading object. Runtime code referred to `books`, tracked books, library items, title records, and external API results. Routes and database assumptions had drifted. A successful TypeScript build could not prove that a review, list item, or progress entry referred to the same canonical work.

### Decision

Make `titles` the application identity and treat external records as evidence about a title, not as alternate product objects. Keep external source IDs, Open Library works, ISBN references, and editions in related tables. Route uncertain metadata through review instead of mutating a canonical title automatically.

### Implementation

- Moved active search, lists, progress, diary, reviews, discussions, and clubs to canonical title IDs.
- Added `title_sources`, `title_reference_works`, `reference_isbns`, and edition relationships.
- Established identifier-first matching:
  1. known external source mapping;
  2. pooled reference ISBN;
  3. primary title ISBN;
  4. title ISBN list;
  5. exact normalized title/author fallback.
- Added sanitization for rendered descriptions and server-side avatar resizing.
- Removed the superseded `/books` and `/library` surfaces after confirming Search Titles covered their intended journey.
- Preserved the old animated reader outside the route tree and documented how it may later become a verified public-domain reader from a canonical title page.

### Verification

- Production builds and type checks were restored at the baseline checkpoint.
- Unit coverage exercises title matching, local search, external result normalization, ingest preparation, and malformed external JSON.
- A legacy inventory records which routes and prototypes were removed, retained, or deferred.

### Trade-off / follow-up

Identifier-first matching is intentionally conservative: some possible duplicates need staff review rather than automatic merging. That adds workflow cost but protects catalog integrity. The public-domain reader remains a scoped roadmap item because text licensing, source verification, pagination, progress integration, and accessibility need deliberate design.

---

## 2. Reading record, genres, and read-gated engagement — March to November 2026

### Problem

Reading state was scattered across old tracking tables and interface-only flags. Genre labels varied between features. Reviews and discussions needed a durable definition of “read,” while guests still needed enough access to understand the product before creating an account.

### Decision

Use default title lists as the durable reading-state model and normalize genres into one shared set. Make finished-list membership the read signal. Keep engagement publicly readable, but require a signed-in finished reader for rating, review, discussion, and like mutations.

### Implementation

- Established default lists:
  - Planned Reading (`to-read`);
  - Current Reading (`current-reading`);
  - Finished Reading (`finished-reading`).
- Added page and audiobook-minute progress modes.
- Stored point-in-time progress with optional diary notes.
- Shared canonical genre values across title search, diary filters, clubs, rewards, onboarding, and metadata review.
- Implemented AND semantics for multi-genre filters: each selected genre narrows the catalog.
- Centralized default-list mutations in `lib/server/title-lists.ts`.
- Made reviews and title discussions visible to guests and unread readers.
- Added capability-driven locked states that explain whether sign-in or finishing is required.
- Enforced rating bounds and read-gated writes in server validation and Postgres.

### Verification

- Unit tests cover genre filtering, title capabilities, rating validation, server-action validation, and progress parsing.
- Browser journeys prove that a guest can browse engagement, an unread reader cannot contribute, read state survives reload, and a finished reader can write.
- Direct authenticated-client tests prove that bypassing the hidden or disabled interface still fails at the database.
- Progress journeys verify that valid progress appears in the diary.

### Trade-off / follow-up

Finished-list membership is simple and inspectable, but it does not yet model rereads or multiple completed sessions. Progress and diary data support future richer history without making that complexity part of the current release.

---

## 3. Onboarding, authentication, roles, and authorization — April to November 2026

### Problem

Early sign-up behavior depended on the page a reader happened to visit. A new account could navigate around onboarding, username checks were vulnerable to races, and public profile roles were being asked to serve as security roles. Hosted Google OAuth also made a cloned project unnecessarily hard to reproduce.

### Decision

Treat onboarding completion as a server-enforced account invariant, separate public profile labels from application authorization, and make local reproduction independent of third-party OAuth.

### Implementation

- Routed every new sign-up to onboarding, regardless of its source page.
- Added direct-navigation protection so an incomplete profile cannot bypass onboarding.
- Required a public username and at least one favorite genre before optional title-selection steps.
- Enforced normalized, case-insensitive username uniqueness in Postgres as well as in availability feedback.
- Moved application authorization to `user_roles`; `user_profiles.role` remains presentation data.
- Limited moderators to suggestion-review capabilities and reserved role-management operations for admins.
- Standardized user-owned operations on cookie-backed, user-scoped Supabase clients.
- Limited the service-role client to narrow trusted server workflows.
- Kept Google authentication as the hosted default while adding local email/password mode and disabling local confirmation delivery.
- Removed the obsolete Kinde compatibility route and documented its historical migration rather than presenting it as active setup.

### Verification

- Browser tests cover sign-up from the guest experience, required onboarding steps, direct-navigation prevention, returning-reader sign-in, and sign-out.
- Database constraints independently reject duplicate normalized usernames.
- Private pages and protected APIs reject anonymous requests.
- CI builds the Google-auth configuration, while the local browser suite uses deterministic email fixtures.

### Trade-off / follow-up

Local email mode deliberately differs from hosted Google only at the authentication provider boundary; all post-session product behavior is shared. Hosted OAuth still requires deployment-specific consent-screen and redirect configuration and therefore needs a manual release check in addition to automated local tests.

Favorite genres are stored but are not yet an editable profile preference or recommendation input. That is honest unfinished product work rather than a demo-only branch.

---

## 4. External discovery and reviewed metadata ingest — April to July 2026

### Problem

Remote catalogs are useful for discovery but inconsistent in identifiers, covers, descriptions, and availability. Directly importing or updating records from Google Books or Open Library risked duplicates and silent corruption. Repeating remote requests during a multi-step flow also made completion slow and unpredictable.

### Decision

Separate external discovery from canonical catalog changes. Reuse short-lived, reader-owned preview data, prefer durable identifiers, and require staff review for uncertain matches or metadata changes.

### Implementation

- Added unified local/external title discovery without treating every external result as a canonical title.
- Added suggestions and suggestion-to-work match records.
- Centralized trusted suggestion finalization so manual review and safe auto-approval share the same write path.
- Split ingest into genre selection and duplicate/work review.
- Added preview ownership, expiry, single-use state, and RLS.
- Reused preview data during final submission instead of refetching the same remote resources.
- Parallelized independent external matching and cover selection where safe.
- Made external API parsing fail-soft and tested malformed or incomplete payloads.
- Added indexes for suggestion review and frequent matching paths.

### Verification

- Unit tests cover Google Books parsing, Open Library parsing, title search merging, preview caching, ingest preparation, and canonical matching.
- Auth and ownership checks protect preview reuse and staff-only finalization.
- Local catalog browsing continues to work when no Google API key is configured.

### Trade-off / follow-up

The reviewed workflow favors correctness over one-click ingestion. External provider availability and quota remain dependencies for discovery, but not for the seeded local catalog. Overlapping historical ingest entry points should only be consolidated after production callers are mapped.

---

## 5. Activity, profiles, clubs, and writers' work — April to May 2026

### Problem

The application had isolated reading records but no coherent social context. Clubs needed more than a boolean membership flag: open groups, reviewed applications, private invitations, reading coordination, and member writing each have different visibility and lifecycle rules.

### Decision

Represent social behavior as explicit domain records. Keep reader following/activity separate from club membership. Give clubs named join policies and give writers' work its own content model instead of overloading reading-club tables.

### Implementation

- Added following relationships, reciprocal friend state, and activity events.
- Replaced synthetic profile activity with real events and added an authenticated following feed.
- Batched related profile loading for reviews and prevented duplicate reward events during edits.
- Added club policies: open, approval required, and invitation only.
- Added membership, applications, invitations, current-reading summaries, notifications, and owner management.
- Added writer-club drafts, participant-visible published works, paginated reading, likes, sanitized rich text, and plain-text list excerpts.
- Added server-side avatar resizing and reusable cover selection helpers for presentation performance.

### Verification

- RLS distinguishes public, participant, author-only, owner-only, and staff-only records.
- Browser coverage verifies the open-club join/leave journey and persistent member counts.
- Direct database checks later expanded to applications, invitations, notification boundaries, and owner-only transitions.
- Sanitization is applied before rich-text display, and author drafts remain private.

### Trade-off / follow-up

Writer-club actions have server and database protection but still need a dedicated browser journey. Club ownership transfer and deletion were not included in the initial lifecycle; owners are prevented from using the ordinary leave path until a deliberate transfer/delete design exists.

---

## 6. Reproducible showcase and protected journeys — November 2026

### Problem

A hiring reviewer could not reliably evaluate the project. Hosted Google OAuth required somebody else's credentials, sparse local data hid the social product, remote cover requests made presentation inconsistent, and manual clicking did not prove authorization boundaries.

### Decision

Build a deterministic local showcase on the real application. Use local email authentication only as an environment choice, seed representative catalog/community data, commit optimized fixture covers, and express the most important journeys as executable contracts.

### Implementation

- Rebuilt `supabase/seed.sql` around:
  - 30 genre-tagged titles;
  - locally committed, resized WebP covers;
  - five active community profiles;
  - one disposable login-ready demo reader;
  - reviews, progress, reading lists, clubs, notifications, and feed activity.
- Documented Node, pnpm, Docker, Supabase, environment mapping, destructive local reset behavior, and reviewer credentials.
- Added guest, new-reader, returning-reader, unread-reader, finished-reader, active-reader, applicant, owner, invitee, and direct-client journey contracts.
- Added Playwright coverage for browser behavior and direct Supabase calls.
- Added GitHub Actions jobs for lint, types, unit tests, production build, and a clean local database/browser suite.
- Pinned Node 22 and pnpm 10.
- Added unknown-error normalization and tests instead of unsafe client error casts.
- Iterated the guest mascot, dark-mode form contrast, hero copy, cover presentation, genre markers, and read-only discussion state through visual review.

### Verification

- `pnpm test:e2e:local` destroys and recreates only the local Supabase database, replays all migrations and fixtures, and runs with one deterministic worker.
- The Step 3 checkpoint recorded 73 passing unit tests and 18 passing browser/database-policy journeys, plus lint, typecheck, and production build.
- The counts are a dated checkpoint, not a permanent marketing claim; the entire release suite must be rerun after showcase changes.

### Trade-off / follow-up

Docker is a real prerequisite because the local demo exercises Auth, Postgres, Storage, RLS, and database functions rather than substituting an in-memory database. That setup is heavier than a static mock, but it reproduces the full-stack behavior under review.

Fixture credentials and activity must never be deployed as production data. The seed is intentionally isolated from runtime code and is never part of hosted migration commands.

---

## 7. Maintainability and approved legacy cleanup — November 2026

### Problem

Large action files, duplicated list mutations, superseded components, obsolete auth remnants, and old routes made the project harder to explain. At the same time, deleting unfamiliar code solely because it was unreachable risked erasing planned work.

### Decision

Inventory before deletion, remove only work explicitly confirmed as superseded, and refactor around protected journeys rather than performing a speculative rewrite. Preserve unfinished work when it has a credible product destination.

### Implementation

- Added the legacy/roadmap inventory before cleanup.
- Removed superseded `book-grid`, `search-bar`, `book-content-tabs`, and `club-edit-form` components.
- Removed the inactive Kinde compatibility surface and obsolete `/books` and `/library` routes.
- Preserved the reader prototype in documentation for later public-domain integration.
- Extracted reusable default-list services and the onboarding title-selection view.
- Kept framework entry points thin where practical and placed reusable domain logic under `lib/server`.
- Delayed splitting the club and ingest action files until behavior had dedicated journey coverage.

### Verification

- Repository searches confirmed removed components and routes had no active callers.
- Lint, typecheck, unit, build, and local journey checks passed at the Step 3 checkpoint.
- The inventory records intentional preservation and remaining caller decisions.

### Trade-off / follow-up

Some large files remain. That is a conscious preference for a tested, behavior-preserving split later rather than a broad movement-only refactor during release preparation. The club domain now has enough journey coverage for a safer structural extraction; writer-club authoring and overlapping ingest callers need more coverage first.

---

## 8. Club lifecycle and notification boundary hardening — November 2026

### Problem

An authorization audit showed that several interface and server-action rules were not true database boundaries. A direct signed-in client could insert membership into a restricted club, broadly rewrite an invitation, or forge notification content. Multi-write application and invitation responses could leave contradictory state if one request failed.

### Decision

Move lifecycle transitions into narrow transactional Postgres functions and remove direct authenticated writes to workflow tables. Make each transition pending-only, identity-derived, atomic, and idempotent. Treat notifications as lifecycle records with explicit resolution rather than best-effort interface decoration.

### Implementation

- Added transactional functions for:
  - open-club joining;
  - application submission, withdrawal, approval, and decline;
  - invitation creation, revocation, acceptance, and decline;
  - member departure and owner-driven removal;
  - recipient-scoped mark-one and mark-all notification reads.
- Each function derives the current profile, checks policy or ownership, locks affected rows, and updates membership, request state, activity, and in-app notification state together.
- Revoked direct membership, invitation/application mutation, and notification creation from ordinary clients.
- Created and backfilled explicit owner membership so catalog and detail counts agree.
- Prevented owner removal and ordinary owner leave.
- Added withdrawal, revocation, removal notifications, stable notification cursor pagination, explicit request payload validation, and count refresh after mutations/focus/visibility.
- Added indexes for recipient feed and unread-count queries.
- Synchronized current application-facing database types and schema constraints with the migration model.

### Verification

- Direct-client tests prove restricted membership insertion, invitation rewriting, and forged notification creation are rejected.
- Lifecycle tests prove pending-only transitions, repeated-response idempotency, notification resolution, and atomic membership/request results.
- Browser tests retain the ordinary open-club path while exercising real database state.
- Static checks cover explicit notification request shapes and supported presentation events.

### Trade-off / follow-up

Remaining deliberate work includes ownership transfer, invitation auto-expiry, a ban or rejoin cooldown for removed members, and a durable outbox for future email/push delivery. Constraining every historical notification event type also requires a production-data inventory.

The application and enforcement migration are mutually dependent during first production rollout. The safe release order is: back up and audit production, apply additive functions/indexes, deploy the matching application, verify club/notification smoke paths, then remove the old direct-write policies.

---

## 9. Showcase release and engineering story — November 2026, in progress

### Problem

The local application is reproducible, but the hiring-review experience also depends on a trustworthy repository, current screenshots, honest Home/About claims, responsive navigation, loading/error behavior, a public deployment, and proof that the hosted commit and database schema match.

### Decision

Treat presentation as a release discipline rather than a separate demo. Correct product claims, improve cross-device and failure states in shared runtime code, capture the real application, and publish one concise README plus this detailed log. Do not claim hosted parity until the same commit and migrations are deployed and checked.

### Implementation

- Reframed About copy around implemented catalog, progress, engagement, and club behavior.
- Added responsive navigation, visible keyboard focus, reduced-motion behavior, and a skip-to-content path.
- Added reviewer-facing loading, error, and not-found states.
- Enabled intentional Next.js cover optimization for supported remote sources while keeping local WebP fixtures.
- Updated generated Supabase types and the maintained Drizzle schema for current club/notification changes.
- Rewrote the README around a three-minute walkthrough, architecture, setup, checks, decisions, and limitations.
- Consolidated the obsolete changelog into this log and prepared a five-minute interview walkthrough.
- Captured four optimized WebP screenshots from the real application: the desktop catalog, guest read-only
  discussion, populated signed-in feed, and mobile catalog. A reproducible Playwright capture script keeps them
  tied to product behavior rather than a design mockup.

### Verification

Local release verification completed on 17 November 2026:

- `pnpm check`: lint, TypeScript, 73 unit tests, and the optimized production build passed;
- `pnpm test:e2e:local`: a fresh migration/seed replay and all 22 browser plus direct-policy journeys passed;
- desktop and phone-sized reviewer journeys were inspected from the real application;
- the four committed showcase screenshots were inspected after WebP conversion (30–61 KB each).

Hosted release verification is intentionally not recorded as complete yet. Before tagging the showcase:

1. make the GitHub repository publicly accessible and confirm links while signed out;
2. integrate the portfolio branch into `main` through a passing pull request;
3. apply the staged production migration, deploy the same application commit, and record both versions;
4. run the read-only hosted smoke suite and manually verify Google OAuth;
5. tag the verified showcase release.

### Trade-off / follow-up

The existing Vercel URL is useful for deployment work but is not evidence of this branch until commit/schema parity is confirmed. The README states that limitation rather than allowing an older deployment to overstate the current project.

A public repository license remains an author decision. Public visibility does not grant reuse rights, so the release should explicitly choose a license or state that no license is granted.

---

## Current verification contract

Fast checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Clean local full-stack verification:

```bash
pnpm test:e2e:local
```

Read-only hosted smoke verification:

```bash
PLAYWRIGHT_BASE_URL=https://your-deployment.example pnpm test:e2e:prod
```

Maintenance rules:

- Add a positive journey and a negative authorization assertion for important user-owned mutations.
- Do not accept a hidden/disabled control as security.
- Keep tests state-independent with stable fixtures, unique temporary records, and cleanup.
- Never reset or seed a hosted database from the local showcase workflow.
- Record verification output at release time; do not keep undated test counts as marketing copy.

## Open engineering decisions

- Choose a repository license before public release.
- Implement club ownership transfer and deliberate deletion.
- Add invitation expiry and a member ban/rejoin-cooldown model.
- Add a durable external-notification outbox and retry worker.
- Add a dedicated writer-club browser journey.
- Decide whether to implement or archive the earlier threaded-discussion prototype.
- Build the planned verified public-domain reader from canonical title pages.
- Map production callers before consolidating overlapping Google ingest actions.
- Decide how long to retain the remaining `/track-reading` compatibility redirect.
- Turn stored favorite genres into editable preferences or recommendation input.
