# Five-minute Bookworm interview walkthrough

This walkthrough is a compact way to demonstrate the product and the engineering decisions behind it. Keep the application, README architecture diagram, and relevant files ready in separate tabs. Show behavior first, then explain the boundary that protects it.

## Before the interview

- Start local Supabase and reset the deterministic showcase database.
- Run the application and sign in once with the local fixture account.
- Keep a guest window and a signed-in window available.
- Run the complete verification suite beforehand and save the current result; do not rely on old test counts.
- If using the hosted app, verify that its deployed commit and database migrations match the repository and that Google sign-in works.

## 0:00–0:40 — State the product and show the journey

> Bookworm helps readers discover titles, keep a useful reading record, and turn finished books into reviews, discussions, and club activity.

Show:

1. Search Titles with multiple genre filters.
2. A title page with public reviews and read-only discussion.
3. The signed-in Home feed or diary.
4. Community with its three club membership policies.

Point out that guests see product value before authentication and that the local setup uses the real full-stack application, not mocked pages.

## 0:40–1:20 — Explain the architecture

Open the README diagram.

Explain the request path:

- React and Next.js App Router provide the browser and server surfaces.
- Supabase Auth supplies a cookie-backed session.
- Normal data access uses a user-scoped client and remains subject to Postgres RLS.
- Server actions validate inputs and coordinate domain operations.
- Narrow trusted server paths use service credentials only where RLS bypass is intentional.
- Supabase migrations are the deployment record for functions, constraints, indexes, and policies.

Useful files:

- `app/layout.tsx`
- `lib/server/auth.ts`
- `lib/supabase-server.ts`
- `db/schema.ts`
- `supabase/migrations/`

## 1:20–2:20 — Walk the read-gating path

Show a guest title page, then the same title after marking it read.

Trace:

1. `app/titles/[id]/page.tsx` loads the public title and current-reader capability.
2. `lib/title-capabilities.ts` gives the interface one vocabulary for guest, unread, and finished-reader states.
3. Title, review, and discussion actions authenticate, validate, and check finished-list state.
4. RLS and database constraints independently reject a direct bypass.
5. `tests/e2e/title-engagement.spec.ts` and `tests/e2e/rls-engagement.spec.ts` prove both the visible path and the database boundary.

Key point:

> The disabled composer is guidance, not security. The server and database enforce the same rule.

## 2:20–3:25 — Walk a transactional club lifecycle

Start with an approval-required or invitation-only club.

Trace:

1. The club interface calls a narrow action in `app/actions/clubs.ts`.
2. The action supplies the authenticated request to a transactional Postgres function.
3. The function re-derives the current profile, checks ownership/policy and pending state, locks the request, and changes request, membership, activity, and in-app notification state together.
4. Ordinary clients cannot directly insert memberships, rewrite invitations/applications, or forge notifications.
5. `tests/e2e/club-lifecycle-security.spec.ts` exercises owner, applicant, invitee, and malicious direct-client cases.

Key point:

> The first implementation had sensible server checks but an audit found direct-client gaps and non-atomic multi-write transitions. The current design moved the invariant to the database transaction.

## 3:25–4:15 — Demonstrate reproducibility and testing

Open:

- `supabase/seed.sql`
- `docs/critical-journeys.md`
- `.github/workflows/ci.yml`

Explain:

- The seed creates 30 tagged titles, local optimized covers, five community profiles, clubs, and meaningful activity.
- Local email authentication removes the need for a reviewer's Google OAuth project; hosted builds still exercise Google mode.
- `pnpm test:e2e:local` resets only local Supabase, applies every migration and fixture, and runs deterministic browser plus RLS journeys.
- CI separates fast quality/build checks from the container-backed full-stack journey job.

Show the latest actual command output rather than quoting a memorized count.

## 4:15–5:00 — Close with trade-offs

Name limitations directly and pair each with a next step:

- **Club ownership:** add transfer and deliberate deletion before allowing owners to leave.
- **Membership moderation:** add invitation expiry and a separate ban/rejoin-cooldown model.
- **External notifications:** add a durable outbox and retry worker for email or push; current in-app lifecycle writes are transactional.
- **Writer clubs:** add a dedicated browser journey around draft, publish, read, and like.
- **Public-domain reader:** verify source rights, attach content to canonical titles, then integrate accessible pagination and progress.
- **Hosted release:** stage the additive database changes, deploy the matching app, apply enforcement, smoke-test, and record commit/schema parity.

Finish with:

> The project is intentionally honest about unfinished scale work. What I wanted to demonstrate is how I turn a product rule into a clear interface, validated server behavior, a database invariant, and a reproducible test.

## Questions to be ready for

### Why Supabase and not a custom API server?

It provided Auth, Postgres, Storage, and RLS while still requiring real backend design. Next.js server actions handle orchestration; Postgres owns durable authorization and atomic lifecycle invariants.

### Why keep reviews visible before a reader finishes?

It makes the product useful to guests and supports discovery. Contribution, not visibility, is the spoiler/community boundary chosen for the current product.

### Why Docker for reviewers?

The showcase exercises the same Auth, Postgres, RLS, Storage, and database functions as the application. Docker is heavier than mocked data but gives a trustworthy, isolated, one-command backend.

### What would you do next with more time?

First complete and record the staged hosted release. Then add writer-club browser coverage and the club ownership/moderation lifecycle before expanding catalog or recommendation features.
