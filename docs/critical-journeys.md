# Critical journeys

Bookworm protects its core product behavior at three layers:

1. The interface exposes only actions the current reader can use and provides explicit sign-in/read-state guidance otherwise.
2. Server actions authenticate the user, require completed onboarding, validate untrusted input, and enforce product rules such as read-gated writing.
3. Postgres row-level security independently protects ownership and read-gated mutations if a client bypasses the interface.

## Journey contract

| Persona | Journey | Required outcome | Protection |
| --- | --- | --- | --- |
| Guest | Browse catalog and titles | Local titles, reviews, and discussions remain readable | Public select policies and guest browser tests |
| Guest | Attempt a mutation | Mark-read, bookmark, tracking, and metadata suggestions lead to sign-in; likes and composers stay disabled | Capability-driven UI plus authenticated server actions |
| Guest | Open private pages or APIs | Private pages redirect to sign-in; protected APIs return `401` | Middleware, page guards, and API checks |
| New reader | Sign up from any page | The next page is onboarding; username and favorite genres are required, saved, and cannot be bypassed through direct navigation | Client routing, validated server actions, database constraints, and browser tests |
| Returning reader | Sign in and out | Sign-in hydrates the populated feed; sign-out refreshes server content and revokes private-route access | Cookie-based SSR auth and browser tests |
| Unread reader | Browse engagement | Reviews and discussions remain readable, while review/post/like mutations stay locked | Capability checks, server read checks, and RLS |
| Finished reader | Mark read and contribute | Read state survives reload and unlocks review/discussion writing | Finished-list state, server actions, and browser tests |
| Active reader | Track progress | Valid progress persists and appears in the diary | Zod action validation, RLS, and browser tests |
| Signed-in reader | Join and leave an open club | Membership and member counts persist through the real UI and database | Club server actions, membership policies, and browser/database assertions |
| Applicant | Request or withdraw club access | One pending application exists, duplicate submissions are idempotent, and withdrawal resolves the owner notification | Transactional database functions and lifecycle integration tests |
| Club owner | Review applications and manage invitations | Only the owner can approve, decline, invite, revoke, or remove; each transition is pending-only and atomic | Owner checks inside security-definer functions, row locks, and direct-client tests |
| Invitee | Accept or decline an invitation | The invitation and membership change together, repeated identical responses are harmless, and stale actions disappear | Transactional database functions and notification resolution metadata |
| Direct client | Bypass the interface | Engagement writes, restricted club membership, invitation rewrites, and forged notifications fail at the database | Authenticated integration tests against local Supabase |

## Deterministic local verification

Docker and the local Supabase stack must be running. The command below destroys and recreates only local database data, replays every migration, loads the showcase seed, and runs all browser and RLS journeys with one worker:

```bash
pnpm test:e2e:local
```

The unit, static, and production checks remain separate so failures are easy to diagnose:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Production smoke tests never reset a database and require an explicit deployment URL:

```bash
PLAYWRIGHT_BASE_URL=https://your-deployment.example pnpm test:e2e:prod
```

## Maintenance rules

- Add a positive journey assertion and a negative authorization assertion when introducing a new user-owned mutation.
- Keep tests state-independent. Use stable seeded identifiers, unique transient records, and cleanup in `finally` blocks.
- Do not treat a hidden or disabled control as authorization; the server action and RLS policy remain the security boundary.
- Keep hosted smoke tests read-only. Database-reset and stateful authorization tests belong to the local suite.
