# 2026-05 Club Invite and Identity Hotfix Log

## Context
This patch is a release-priority follow-up on two production-facing issues:

1. club invite state could drift into duplicate/ambiguous rows, which made pending invite state unreliable and could break club page reads
2. the navbar could briefly render an email-derived fallback before the real username resolved

I treated this as a hotfix pass: stabilize the failing workflow first, reduce user-facing ambiguity second, and close the remaining data-integrity gap at the schema/migration layer.

## What changed

### 1. Hardened club invite reads and writes
Files:
- app/actions/clubs.ts

Work completed:
- replaced brittle single-row assumptions in invite/application lookups with ordered row selection
- added small helper utilities to consistently prefer the most relevant club status row
- hardened the invite action so legacy duplicate rows no longer cause the wrong invite/application record to be read
- deduped pending invitation/application lists at read time so club management screens stay stable even if legacy duplicate rows still exist before migration runs

Why:
- this prevents club invite state from exploding when production data does not perfectly match the intended uniqueness rules

### 2. Tightened invite selection UX
Files:
- app/api/community/clubs/[id]/invite-candidates/route.ts
- components/club-manage-form.tsx

Work completed:
- broadened invite lookup to search all readers, not just connected users
- kept connected readers ranked ahead of everyone else
- required managers to pick an explicit suggestion before sending an invite
- improved empty/loading states and surfaced server errors more clearly in the invite flow

Why:
- this removes ambiguous free-text invite attempts while preserving discoverability when the intended invitee is not already connected to the manager

### 3. Removed navbar email flash
Files:
- components/navigation.tsx

Work completed:
- removed the email-derived fallback for authenticated users
- added a lightweight profile-loading state so the navbar stays neutral until username data resolves

Why:
- the app should never visually imply that email local-parts are canonical usernames

### 4. Enforced username and invite integrity at the data layer
Files:
- db/schema.ts
- supabase/migrations/20260506120000_club_invite_cleanup_and_username_integrity.sql

Work completed:
- marked `user_profiles.username` as required in schema
- added migration cleanup for duplicate `club_applications` and `club_invitations`
- recreated the uniqueness indexes after cleanup
- backfilled missing/blank usernames with generated placeholders
- updated `handle_new_user()` so future profile bootstrap no longer uses email as username fallback
- enforced `username` as `NOT NULL` after backfill

Why:
- application hardening is useful, but the real long-term fix is to make the database enforce the invariants the code expects

## Validation
- ran a full production build
- result: `pnpm build` passed successfully

## Release notes
This hotfix is intended to be safe to ship quickly because it:
- preserves current club invite product behavior
- improves read-side tolerance for legacy bad data
- adds forward-looking DB constraints so the issue does not regress after rollout

## Suggested rollout order
1. merge PR
2. run migrations in production
3. smoke-test:
   - invite a user to a club
   - verify pending invites render correctly
   - attempt repeat invite
   - refresh while authenticated and confirm navbar shows username, not email-derived text
