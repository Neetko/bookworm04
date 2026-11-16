# Bookworm development log

This is the maintained engineering history for Bookworm. It explains the product changes, architectural decisions, trade-offs, and verification that shaped the current application. Older branch notes are retained under `docs/archive/` for historical reference, but this is the canonical log for reviewers.

## Current product direction

Bookworm is a title-centric reading community. Canonical titles connect reading progress, diary entries, lists, reviews, discussions, clubs, metadata suggestions, and social activity. The project uses Next.js, React, Supabase Auth/Postgres/Storage/RLS, and a locally reproducible showcase dataset.

The recurring engineering rule is defense in depth:

1. The interface explains whether an action is available.
2. Server actions authenticate, validate input, and enforce product rules.
3. Postgres RLS and constraints protect data even if a caller bypasses the interface.

## 2026-01 — Typed baseline and data-model stabilization

The early project was brought to a working typed baseline. Initial work focused on understanding the inherited book, profile, list, review, and club relationships; restoring successful builds; and identifying areas where browser behavior and database assumptions had drifted apart.

Important lesson: passing TypeScript was necessary but not sufficient. The project needed explicit product invariants and database-level enforcement rather than relying on UI state.

## 2026-03 — Canonical genres, progress, diary, and lists

Reading progress was redesigned around canonical titles and two progress modes: pages and audiobook minutes. Diary entries began storing point-in-time progress alongside optional reader notes.

Genre handling was normalized into a small canonical set shared by catalog search, diary filters, clubs, reward calculations, and metadata review. Multi-genre filtering uses AND semantics so each additional genre narrows results.

Default title lists became the central state model:

- Planned Reading (`to-read`)
- Current Reading (`current-reading`)
- Finished Reading (`finished-reading`)

Finished-list membership became the durable “read” signal used by reviews and discussions.

## 2026-04 — Title-centric migration and legacy book cleanup

Runtime behavior moved from the legacy `books` model to canonical `titles`. Search, lists, progress, reviews, discussions, and clubs were updated to reference title IDs. Old book routes were retained as small redirects so existing links did not immediately break.

The active model now separates:

- canonical title records;
- external source identifiers;
- pooled Open Library work references;
- normalized ISBN references;
- edition records;
- user-submitted metadata suggestions.

This made duplicate detection and metadata review explicit instead of allowing external API results to silently mutate canonical records.

## 2026-04 — Activity feed and social graph

User follows, reciprocal friend state, and activity events were introduced. The authenticated home page gained a following feed backed by real activity data. Profile pages began showing recent activity instead of synthetic placeholders.

Review loading was changed to batch related profile data, and existing reviews could be edited without creating duplicate reward events.

Search gained an initial local catalog view and client-side title/author filtering while retaining external discovery for authenticated users.

## 2026-04 — Suggestions, dedupe, references, and covers

Metadata changes were moved behind a suggestion-review workflow. Title dedupe stopped writing directly and instead submitted work/reference choices for staff review.

Matching confidence follows durable identifiers before text similarity:

1. Known external source mapping.
2. Pooled reference ISBN.
3. Primary title ISBN.
4. ISBN list.
5. Exact normalized title and author fallback.

Cover selection became reviewable and cacheable. The application can reuse local cover choices rather than depending on a remote image request on every render.

## 2026-04 — Onboarding and RLS hardening

First-run onboarding was added and later strengthened so incomplete accounts cannot bypass it by entering a protected URL directly. Username uniqueness is now enforced case-insensitively in Postgres, not only through an availability check.

RLS was expanded across private reading data, profiles, lists, reviews, discussions, likes, bookmarks, clubs, messages, notifications, suggestions, and storage.

Application code was adjusted to use user-scoped clients for normal operations and the service-role client only for narrow trusted workflows such as controlled notifications and staff approval.

## 2026-04 — Staff roles and suggestion approval

Application authorization moved to `user_roles`; the role field on public profiles became presentation data only. Moderators received suggestion-review capabilities without receiving unrestricted admin access.

Suggestion finalization was centralized so manual staff review and trusted auto-approval use the same write path. This reduced the risk of one approval surface applying only part of a metadata change.

## 2026-05 — Club membership lifecycle

Clubs gained explicit join policies:

- open;
- approval required;
- invite only.

Applications and invitations received owner/member workflows, notification lifecycle handling, deduplicated reads, and stronger database uniqueness. Invite discovery searches readers explicitly rather than accepting ambiguous free text.

Current-reading views gained member progress summaries. Club actions remain one of the largest domains and are intentionally scheduled for refactoring only after dedicated owner/member/applicant journey tests exist.

## 2026-05 — Writer-club works

Writer clubs gained their own manuscript model rather than overloading reading-club tables. Members can create drafts, publish work to club participants, read paginated content, and like published works.

Access rules distinguish private author drafts from participant-visible published work. Sanitization and plain-text excerpts are applied before storage and list rendering.

## 2026-05 — Ingest workflow performance

Google/Open Library ingest was split into genre selection followed by duplicate/work review. Preview data can be reused server-side rather than refetched during final submission.

External matching, suggestion preparation, and cover choices were parallelized where safe. Lower-confidence matches remain reviewable instead of becoming silent canonical mutations.

## 2026-07 — Query and preview hardening

Indexes were added for high-traffic portfolio paths and suggestion review. Google ingest previews received user ownership, expiry, single-use state, and RLS policies.

These changes made the ingest flow more deterministic while keeping external requests outside the critical final-write path where possible.

## 2026-11 — Mascot and rating presentation

The guest landing page gained an animated Bookworm mascot with a restrained idle smile and blink cycle. Rating interactions gained mascot reactions while retaining accessible controls and the established warm editorial visual system.

Sprite sizing, speech-bubble placement, dark-mode input contrast, and guest homepage copy were iterated through visual review.

## 2026-11 — Reproducible portfolio demo

The local showcase was rebuilt around a deterministic Supabase seed:

- 30 tagged titles;
- locally committed, resized WebP covers;
- five active community profiles;
- one disposable login-ready demo reader;
- reading, review, club, and activity fixtures.

Local authentication uses email/password and does not require a reviewer to create Google OAuth credentials. Hosted deployments can still use Google authentication.

The README now documents exact prerequisites, environment mapping, reset behavior, demo credentials, and validation commands. `supabase db reset --local` recreates only the local database and replays every migration plus the showcase seed.

## 2026-11 — Protected critical journeys

The project defined explicit guest, new-reader, returning-reader, active-reader, unread-reader, and finished-reader behaviors.

Protection was added at three layers:

- capability-driven controls and explanatory locked states;
- authenticated, validated server actions;
- Postgres policies and constraints.

Important outcomes include:

- new signups are always routed through onboarding;
- onboarding requires a unique username and at least one favorite genre;
- guests can browse titles, reviews, and discussions but cannot mutate them;
- unread readers can view engagement while contribution remains locked;
- read state persists and unlocks reviews/discussions;
- partial progress appears in the diary;
- private pages and APIs reject anonymous access;
- invalid ratings and engagement bypass attempts fail at the database.

The deterministic local journey suite resets the database and tests real browser behavior plus direct RLS rejection.

## 2026-11 — Step 3 maintainability pass

The portfolio work was checkpointed on `codex/portfolio-readiness-step3` before structural refactoring.

Initial low-risk improvements:

- pinned Node 22 and pnpm 10;
- added GitHub CI for lint, types, unit tests, and production builds;
- consolidated duplicated default-list mutations behind `lib/server/title-lists.ts`;
- extracted the onboarding book-selection renderer while retaining state and effects in the onboarding controller;
- introduced `getErrorMessage(error: unknown, fallback)` and removed loose error casts from client mutation controls;
- added a deterministic open-club join/leave journey with direct database assertions and cleanup;
- documented unreachable prototypes and compatibility routes without deleting them.

Large club and ingest files were not split immediately. Club membership now has an initial member journey, but owner, applicant, invitation, and writer-club journeys still need coverage before that domain is safely divided. The overlapping legacy ingest paths also need a product/caller decision before consolidation.

## Current verification contract

Fast checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Clean local journey verification:

```bash
pnpm test:e2e:local
```

The E2E command resets the local Supabase database, applies all migrations, loads the showcase seed, and runs browser and RLS journeys with deterministic worker settings.

Current verified result: 14 browser/database-policy journeys and 69 unit tests pass.

## Open engineering decisions

- Whether to implement or archive the earlier threaded-discussion prototype.
- Whether an in-app reader belongs in the product and what licensed content model it would use.
- How long to retain redirects for legacy `/books`, `/library`, and `/track-reading` URLs.
- Whether to consolidate overlapping Google ingest actions after production callers are mapped.
- How to split club membership/current-reading/management actions after dedicated club journeys exist.
- When to adopt regenerated Supabase database types across each domain.

See `docs/legacy-and-roadmap-inventory.md` for the exact files involved in the first three decisions.
