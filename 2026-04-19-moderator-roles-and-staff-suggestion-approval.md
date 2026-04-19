# 2026-04-19 — Moderator roles and staff suggestion approval

## Summary

This branch introduces a dedicated application-level role model backed by `public.user_roles`, expands suggestion review access to moderators, adds admin tooling to manage moderators, and allows staff users to auto-approve selected metadata workflows from the normal product UI.

It also normalizes the public-facing profile role label to a simpler set of values:

- `reader`
- `moderator`
- `admin`

The branch intentionally **does not** automate any environment-specific admin assignment by username. Admin assignment is expected to be handled manually per environment when needed.

---

## Goals

1. Move authorization logic onto `user_roles` instead of relying on `user_profiles.role`.
2. Support a real `moderator` application role.
3. Allow moderators to review suggestions alongside admins.
4. Let staff users bypass the review queue when performing trusted metadata cleanup.
5. Add an admin-only moderator management screen.
6. Expose staff entry points in the UI.
7. Keep a public-facing role label that matches current access level.

---

## Architecture decisions

### 1. `user_roles` is the authorization source of truth

The branch centralizes runtime access checks in `lib/server/roles.ts`.

Key helpers:

- `normalizeAppRole()`
- `canReviewSuggestions()`
- `canManageRoles()`
- `getUserAccessForAuthUserId()`
- `getCurrentUserAccess()`

The important behavioral change is that application authorization now resolves from `public.user_roles`, while `public.user_profiles.role` is treated as a public-facing label.

### 2. Moderators share suggestion-review powers with admins

Moderators can:

- open the suggestion review page
- save suggestion review state
- approve suggestions
- dismiss suggestions
- use suggestion review utilities like candidate lookup and cover choice lookup

Moderators cannot:

- manage roles from the new moderator management page

### 3. Staff auto-approval is handled by creating then finalizing suggestions

For dedupe and Google ingest flows, the branch preserves the suggestion-based workflow but allows trusted users to auto-finalize the suggestion immediately after insert.

This keeps the finalization path consistent with normal suggestion approval while still giving staff a faster path.

### 4. Public profile labels were simplified

`user_profiles.role` previously behaved like a looser community label. The branch now normalizes it to `reader`, `moderator`, or `admin` so the public-facing profile badge matches the application-level access model.

This is a product decision as much as a technical one. If richer community descriptors are needed later, they should likely move to a separate field instead of sharing the same column with an auth-adjacent concept.

---

## Files changed by concern

### Authorization and migrations

- `lib/server/roles.ts`
- `db/schema.ts`
- `supabase/migrations/20260419120000_moderator_roles.sql`
- `supabase/migrations/20260419121000_staff_roles_user_roles_only.sql`
- `supabase/migrations/20260419122000_public_role_labels.sql`

What changed:

- added the `moderator` enum value to `app_role`
- split the enum migration from the data/policy migration to avoid PostgreSQL enum-transaction issues
- backfilled `user_roles` from existing profile data for staff users
- redefined SQL helper functions to rely on `user_roles`
- updated suggestion and suggestion-work-match RLS policies to allow staff access
- added `userRoles` to the Drizzle schema
- normalized public role labels to `reader` / `moderator` / `admin`

### Shared suggestion approval logic

- `lib/server/suggestion-approval.ts`
- `app/actions/suggestions.ts`

What changed:

- extracted final suggestion approval behavior into a shared helper
- standardized title updates, approved work merging, reference-work upserts, ISBN upserts, and optional cover application
- switched suggestion actions from admin-only role checks to shared staff-aware role checks

### Moderator management

- `app/actions/admin.ts`
- `app/admin/moderators/page.tsx`
- `app/admin/suggestions/page.tsx`

What changed:

- added admin-only server actions to assign moderator role
- added admin-only server actions to remove moderator role back to `user`
- synchronized public role labels during promote/demote operations
- added a search-driven moderator management page
- added a shortcut from the suggestions admin page to moderator management for admins
- changed suggestion review messaging from admin-only wording to moderator/admin wording

### Staff auto-approval in product flows

- `app/actions/title.ts`
- `app/actions/track-reading.ts`
- `app/search-titles/page.tsx`
- `app/search-titles/search-titles-client.tsx`
- `app/titles/[id]/page.tsx`
- `components/title-dedupe-dialog.tsx`
- `components/track-reading-result-list.tsx`

What changed:

- title dedupe submissions by staff auto-finalize suggestions immediately
- Google ingest suggestions by staff auto-finalize suggestions immediately
- the UI now distinguishes between normal user review submission and staff verification
- result payloads return `autoApproved` so the client can show accurate success states
- pages now pass role-aware props into the relevant UI components

### Navigation and notifications

- `components/navigation.tsx`
- `app/notifications/page.tsx`

What changed:

- the account menu now reads the application role from `user_roles`
- moderators/admins get a `Review suggestions` entry
- admins get a `Manage moderators` entry
- the notifications page gained a label for `moderator_assigned`

---

## Database migration notes

### `20260419120000_moderator_roles.sql`

Purpose:

- adds the `moderator` value to `public.app_role`

Reason it was split out:

- PostgreSQL treats new enum values as unsafe for immediate use inside the same transaction in some migration flows
- isolating the enum change avoids the earlier migration failure

### `20260419121000_staff_roles_user_roles_only.sql`

Purpose:

- backfills `public.user_roles` for existing staff users
- redefines `is_current_user_admin()`
- introduces `is_current_user_staff()`
- updates suggestion-related policies to allow moderators

Important note:

- this migration no longer contains any environment-specific username promotion logic

### `20260419122000_public_role_labels.sql`

Purpose:

- updates `user_profiles.role` to reflect the current `user_roles` record
- defaults remaining authenticated profiles without a role row to `reader`

Important note:

- this migration only normalizes public labels; it does not assign environment-specific admins

---

## Behavior changes

### Suggestion review

Before:

- admin-only

After:

- admin + moderator

### Dedupe suggestion flow

Before:

- always submitted for later admin review

After:

- normal users still submit for review
- moderators/admins auto-finalize immediately

### Google ingest suggestion flow

Before:

- always created a suggestion pending later review

After:

- normal users still create a suggestion
- moderators/admins auto-finalize immediately

### Public role display

Before:

- could contain broader community-style values like `Reader`, `Critic`, etc.

After:

- normalized to `reader`, `moderator`, or `admin`

---

## Validation completed

Validation performed during implementation:

- `supabase migration up`
- `pnpm exec tsc --noEmit`

Status at time of notes:

- migrations applied successfully after the enum split
- TypeScript validation passed

---

## Risks and follow-ups

### 1. Public role label scope changed

Because `user_profiles.role` now mirrors access level, any UI that previously treated this field as a broader community descriptor will now show `reader`, `moderator`, or `admin` instead.

If richer public descriptors are still desired, a separate field should be introduced later.

### 2. Staff auto-approval still depends on external enrichment

`finalizeSuggestionApproval()` updates local suggestion/title state and also performs reference-data enrichment. If downstream external metadata calls fail, the approval may still succeed with partial enrichment.

This is acceptable for now, but it is worth revisiting if stronger transactional guarantees are needed.

### 3. Moderator removal does not notify the user

Assignment generates a `moderator_assigned` notification.
Demotion currently resets access and public label without sending a corresponding notification.

That may be fine, but it is a product decision worth confirming later.

### 4. Rollout order matters

Deployed environments should receive the migrations before, or alongside, the UI changes that read from `user_roles` and show staff entry points.

---

## Recommended deployment order

1. Apply database migrations.
2. Deploy application code.
3. Manually confirm admin assignments per environment if needed.
4. Verify:
	- admin can open `/admin/moderators`
	- moderator can open `/admin/suggestions`
	- normal user cannot open either admin screen
	- staff dedupe flow shows `Verify now`
	- staff ingest flow shows immediate verification success messaging
	- public role badges display normalized values

---

## Final state

The branch leaves the project in a cleaner RBAC state:

- application permissions come from `user_roles`
- moderators are first-class staff users
- suggestion review and trusted metadata cleanup are faster for staff
- public role labels align with current access
- admin role management now exists inside the product
