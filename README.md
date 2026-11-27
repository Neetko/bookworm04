# Bookworm

[![CI](https://github.com/Neetko/bookworm04/actions/workflows/ci.yml/badge.svg)](https://github.com/Neetko/bookworm04/actions/workflows/ci.yml)

Bookworm is a full-stack reading community for discovering titles, keeping a useful reading record, and turning finished books into reviews, discussions, and club activity.

**Hosted application:** [bookworm04.vercel.app](https://bookworm04.vercel.app)

**Reproducible local public showcase:** no Google OAuth credentials required

> The hosted application runs from `apps/start` through TanStack Start and Nitro on Vercel. The previous Next implementation remains in the repository only as a temporary rollback and deterministic browser-test harness.

![Bookworm catalog with title covers and genre filters](docs/images/bookworm-catalog.webp)

## Try Bookworm in three minutes

1. Open **Search Titles** and combine genre filters. Selecting more genres narrows the result to titles carrying every selected tag.
2. Open a title. Reviews and discussion remain readable to guests; contribution controls explain why sign-in and finished-reading state are required.
3. Sign in with Google on the hosted app, add titles to your lists, and keep progress or diary notes. Private state survives reloads and remains account-scoped.
4. Visit **Home** to see a populated following feed, then **Community** to compare open, approval-required, and invitation-only clubs.
5. Create a fresh account to exercise the real first-run path: every sign-up chooses a public username and favorite genres before entering the catalog and reading-list flows.

The preserved Next browser-test harness has a disposable local fixture account:

```text
Email: demo@bookworm.test
Password: BookwormDemo!2026
```

These credentials work only after the local database reset and only in the legacy test harness (`pnpm dev` at port 3000). They are not published to or accepted by the hosted TanStack application.

## What the project demonstrates

- **Catalog and discovery:** canonical titles, locally cached showcase covers, title/author search, and multi-genre AND filtering.
- **Reading record:** planned/current/finished lists, page or listening progress, and point-in-time diary entries.
- **Read-gated engagement:** public review and discussion reading, with rating, review, post, and like mutations unlocked only after finishing a title.
- **Community:** following activity, messages, notifications, reading clubs, writers' clubs, and open/approval/invite membership policies.
- **Metadata stewardship:** Google Books and Open Library discovery flows into a reviewed canonical catalog instead of silently overwriting local records.
- **Defense in depth:** capability-aware controls, authenticated and validated server actions, and independent Postgres row-level security.
- **Reproducibility:** deterministic Supabase fixtures, optimized local cover assets, unit tests, browser journeys, direct database-policy tests, and CI.

## Architecture

```mermaid
flowchart LR
  Browser[Browser<br/>React client] --> Start[TanStack Start<br/>router + SSR]
  Start --> Server[Start server functions<br/>and route handlers]
  Browser --> Server

  Server --> Auth[Supabase Auth<br/>cookie-backed session]
  Server --> UserClient[User-scoped<br/>Supabase client]
  UserClient --> Security[RLS + constraints +<br/>transactional functions]
  Security --> Postgres[(Postgres)]

  Server --> Trusted[Narrow trusted<br/>server operations]
  Trusted --> ServiceRole[Service-role client]
  ServiceRole --> Postgres

  Google[Google Books] --> Discovery[External discovery and<br/>ingest preview]
  OpenLibrary[Open Library] --> Discovery
  Discovery --> Review[Suggestion and<br/>staff-review workflow]
  Review --> Titles[Canonical titles]
  Titles --> Postgres

  Seed[Local seed] --> LocalDB[Local Supabase]
  LocalDB --> Journeys[Playwright browser +<br/>RLS journeys]
```

The important boundary is the database, not the visibility of a button. Normal user operations run with the reader's session and remain subject to RLS. Trusted credentials are limited to narrow server-only workflows such as controlled notification creation and staff metadata approval.

## Representative engineering decisions

### One canonical title model

Reviews, discussions, lists, progress, diary entries, and clubs all reference canonical `titles`. External source IDs, ISBN references, and editions are separate records. That prevents a Google/Open Library result from becoming a second product identity for the same work.

### Finished-list membership is the read signal

Moving a title into the finished list is the durable source of truth for read-gated actions. The interface uses that capability to explain locked controls, server actions check it again, and database policies reject direct bypass attempts.

### Club transitions are database transactions

Joining, applying, approving, inviting, accepting, declining, leaving, and removing run through narrow Postgres functions. Each function derives the current reader, checks club policy and request state, and updates membership, activity, request status, and in-app notifications atomically.

### The demo is data, not a second product

Runtime pages, actions, migrations, and authorization are shared with the maintained application. Demo-only differences are limited to deterministic local fixtures, optimized fixture cover files, and local email/password authentication. A fix that exists only in seed data is not considered complete.

## Local setup

### Prerequisites

- Node.js 22
- pnpm 10
- Docker with its daemon running
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

Docker is expected for the local showcase because Supabase runs Auth, Postgres, Storage, and its supporting services in containers. Reviewers do not need a hosted database or a Google Cloud project.

### 1. Install dependencies

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/start install --frozen-lockfile
```

### 2. Start and seed local Supabase

```bash
supabase start
supabase db reset --local
```

The reset replays all migrations and `supabase/seed.sql`. It creates 30 tagged titles, optimized local WebP covers, five active community profiles, a populated demo reader, and clubs covering all three membership policies.

`db reset --local` deletes **local** database data. Never run the reset or load the showcase seed against a remote project.

### 3. Configure the application

```bash
cp .env.example apps/start/.env.local
supabase status -o env
```

Copy the values as follows:

| Supabase output | `.env.local` |
| --- | --- |
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Keep the service-role key server-side and out of Git. `DATABASE_URL` is required only for Drizzle commands. `GOOGLE_BOOKS_API_KEY` is optional; local catalog browsing remains available without it, while external discovery receives the provider's unauthenticated quota.

The production Start app is Google-only. The preserved local Next journey still uses `NEXT_PUBLIC_AUTH_MODE=email` for disposable browser fixtures; it is a rollback/test harness rather than the hosted runtime.

### 4. Run Bookworm

```bash
pnpm --dir apps/start dev
```

Open [http://localhost:3101](http://localhost:3101).

To rebuild the committed showcase covers from their pinned Open Library records:

```bash
pnpm demo:covers
```

## Verification

Fast checks:

```bash
pnpm --dir apps/start typecheck
pnpm --dir apps/start build
```

The root Next checks remain during the rollback window, and clean local browser/database-policy verification still runs against the deterministic harness:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:local
```

That command resets only the local database before running deterministic journeys with one worker. The suite covers guest access, sign-up/onboarding, sign-in/out, read gating, progress/diary behavior, club membership lifecycles, notification boundaries, and direct RLS bypass attempts.

Hosted smoke tests are deliberately read-only and require an explicit URL:

```bash
PLAYWRIGHT_BASE_URL=https://your-deployment.example pnpm test:e2e:prod
```

The CI quality job builds the hosted Google-auth path. The local journey job uses disposable email/password fixtures.

## Hosted Google sign-in

Hosted Start builds use Google sign-in. Every deployment needs an exact `PUBLIC_APP_ORIGIN`, the Supabase callback URL in Google, and `${PUBLIC_APP_ORIGIN}/auth/callback` in Supabase's allowed redirect list.

See the [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls). A Google consent screen left in testing mode or a missing redirect URL can make a healthy application appear broken. This is why local reproduction intentionally does not depend on OAuth.

## Project layout

| Area | Responsibility |
| --- | --- |
| `apps/start/src/routes/` | TanStack Start pages and HTTP route handlers |
| `apps/start/src/features/` | Product UI, validation, reads, and authenticated server writers |
| `apps/start/src/server/` | Request-scoped auth, trusted clients, response policy, and bounded parsing |
| `app/`, `components/`, `lib/` | Preserved Next rollback implementation during the observation window |
| `supabase/migrations/` | Deployment source of truth for schema, functions, constraints, and RLS |
| `supabase/seed.sql` | Local-only deterministic showcase data |
| `tests/unit/` | Fast business-rule and integration-helper tests |
| `tests/e2e/` | Browser journeys and direct local-Supabase policy tests |

`db/schema.ts` is kept in sync for typed schema tooling, while Supabase migrations are the deployment record.

## Honest limitations

- The hosted endpoint exists, but the final portfolio branch, schema version, and Google OAuth journey must be verified together before the showcase release is tagged.
- The 30-title catalog is a deterministic reviewer dataset, not a claim of production catalog scale.
- Google Books and Open Library availability and quotas are external dependencies; the local catalog remains usable when they are unavailable.
- Club ownership transfer, invitation auto-expiry, and a distinct ban/rejoin-cooldown model are not yet implemented.
- In-app lifecycle notifications are transactional, but email or push delivery would need a durable outbox and retry worker.
- Writer-club authoring has server/RLS coverage but still needs a dedicated browser journey.
- The preserved reader prototype is not a public route. Reading verified public-domain text from a canonical title page is a documented follow-up.

## Engineering documentation

- [Development log](DEVELOPMENT_LOG.md) — the single maintained history of problems, decisions, implementations, checks, and trade-offs.
- [Critical journeys](docs/critical-journeys.md) — persona-level behavior and authorization contract.
- [Portfolio readiness roadmap](docs/portfolio-readiness-roadmap.md) — one-product delivery rule and release criteria.
- [Legacy and roadmap inventory](docs/legacy-and-roadmap-inventory.md) — intentionally removed or preserved historical work.
- [Public-domain reader roadmap](docs/roadmap/public-domain-reader.md) — planned reader requirements.

Historical notes under `docs/archive/` are unmaintained source material. They are retained for provenance, not as current setup or product documentation.
