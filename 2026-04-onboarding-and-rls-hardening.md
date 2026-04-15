# April 2026 Branch Log: Onboarding, Security Hardening, and Release Readiness

## Summary

This branch consolidates a broad production-readiness pass across product UX, database security, runtime safety, and release hygiene. The work started from a typography regression, expanded into a first-run onboarding flow for new accounts, and then moved into a full Supabase row-level security rollout with application-side adaptations required to keep the product functional under stricter access controls.

The branch intentionally combines schema changes, application changes, and operational hardening because each area depended on the others:

- onboarding required new profile state and routing behavior
- row-level security required both SQL policy work and code-path changes
- stricter database and storage policies exposed places where the app still depended on overly broad client access
- production checks were restored so hidden type and lint issues could be fixed before deployment

## 1. Typography Restoration and Delivery Fix

### What changed

The application typography was restored to the intended stack:

- IM Fell English SC
- IM Fell English
- Source Code Pro
- default tracking aligned with the intended visual system

The font delivery mechanism was also replaced. The previous setup relied on `next/font/google`, but runtime verification showed generated font assets returning 404s from Next.js static media output. The implementation was migrated to local `@fontsource` packages instead.

### Files involved

- app/layout.tsx
- app/globals.css
- tailwind.config.ts
- package.json
- pnpm-lock.yaml

### Why this approach

Restoring only the font declarations was not enough, because the runtime asset pipeline itself was failing. Moving to local packaged font assets removed the external/runtime font fetch dependency and made typography deterministic in both development and production builds.

## 2. First-Run Onboarding Flow

### What changed

A dedicated onboarding flow was added for newly created accounts. The flow now:

1. requires a username before progressing
2. allows later steps to be skipped
3. lets users seed default reading lists during onboarding
4. suggests readers to follow based on book overlap
5. completes onboarding only at the final step

The onboarding experience is routed through a dedicated page and backed by new server actions and shared helpers.

### Product rules implemented

- usernames are mandatory before leaving the first step
- username availability is checked case-insensitively
- original username casing is preserved when saved
- onboarding book selections feed default reading lists
- a title may appear in only one onboarding list
- skipping later steps still allows onboarding completion
- onboarding is marked complete only after the final step action

### Files involved

- app/onboarding/page.tsx
- components/onboarding-client.tsx
- app/actions/onboarding.ts
- lib/onboarding.ts
- app/auth/callback/page.tsx
- app/page.tsx
- app/actions/profile.ts

### Why this approach

The flow was separated into dedicated actions and helpers so that username validation, list seeding, and follow suggestions stayed consistent between onboarding and later profile editing. Completion logic was intentionally isolated to the final step after an earlier version completed onboarding too early from the username screen.

## 3. Onboarding Persistence in Schema and Migrations

### What changed

The profile model now stores `onboarding_completed_at` so onboarding state is explicit and queryable.

This was added in both schema definitions and SQL migrations.

### Files involved

- db/schema.ts
- drizzle/0035_user_onboarding.sql
- supabase/migrations/20260415120000_user_onboarding.sql

### Why this approach

A timestamp is more operationally useful than a boolean because it records both state and completion timing, supports future audits, and avoids ambiguity during backfills or migrations.

## 4. Full Supabase RLS Rollout

### What changed

This branch enables and defines row-level security across the application data model in phases, starting with highest-risk private data and moving outward to social, community, metadata, and legacy tables.

### RLS phases

#### Phase 1: Private user data

Protected the highest-risk private tables first:

- messages
- notifications
- title_user_progress
- reading_diary_entries

Introduced helper functions including:

- `current_profile_id()`
- `is_current_user_admin()`

#### Phase 2: Profiles and lists

Protected private profile data and reading lists, while introducing a safe public projection:

- `public.public_profiles`
- `user_profiles`
- `title_lists`
- `title_list_items`

#### Phase 3: Social interaction tables

Protected follow relationships and user-generated discussion/review data:

- `user_follows`
- `reviews`
- `review_likes`
- `discussion_posts`
- `post_likes`
- `title_bookmarks`

Introduced `has_finished_title(uuid)` to enforce finished-title requirements in review and discussion surfaces.

#### Phase 4: Clubs and activity

Protected community and club operations:

- `clubs`
- `club_members`
- `club_reading_items`
- `club_reading_comments`
- `club_applications`
- `activity_events`

Introduced helper functions including:

- `can_manage_club(uuid)`
- `is_club_participant(uuid)`
- `can_view_activity_for(uuid)`

#### Phase 5: Remaining canonical and support tables

Protected the remaining public-facing and internal support tables:

- `titles`
- `editions`
- `title_list_likes`
- `user_genre_points`
- `user_experience`
- `title_sources`
- `title_reference_works`
- `reference_isbns`
- `work_cover_cache`
- `suggestions`
- `suggestion_work_matches`

#### Legacy protection

Secured remaining legacy tables and updated the auth token hook behavior:

- `title_reads`
- `user_roles`
- `custom_access_token_hook(event jsonb)`

### Files involved

- supabase/migrations/20260415140000_private_data_rls.sql
- supabase/migrations/20260415150000_profiles_and_lists_rls.sql
- supabase/migrations/20260415160000_social_interactions_rls.sql
- supabase/migrations/20260415170000_clubs_and_activity_rls.sql
- supabase/migrations/20260415180000_remaining_tables_rls.sql
- supabase/migrations/20260415183000_legacy_tables_rls.sql

### Why this approach

The rollout was phased to reduce risk and keep the app operable while each policy layer was introduced. High-risk private data was protected first, public projections were added where necessary, and only then were broader social and metadata tables locked down. This made it easier to validate each stage and update application queries in parallel.

## 5. Application Refactors Required by RLS

### What changed

After RLS was introduced, several application paths needed to stop depending on direct broad reads or writes. The branch updates those paths to use either:

- `public_profiles` for public-safe identity reads
- admin-backed service-role access for trusted server-side operations that should not depend on end-user RLS visibility

### Key refactor themes

- public identity lookups moved away from raw `user_profiles`
- notification writes moved to trusted server-side paths where appropriate
- message mutation routes now guard updates and deletes with both ownership and server-side enforcement
- club, discussion, suggestion, and title-maintenance flows were aligned to the new access model
- admin checks were standardized around `user_profiles.role`

### Files involved

Representative examples include:

- app/actions/clubs.ts
- app/actions/follow.ts
- app/actions/reviews.ts
- app/actions/suggestions.ts
- app/actions/title.ts
- app/actions/track-reading.ts
- app/admin/suggestions/page.tsx
- app/api/messages/[id]/route.ts
- app/api/messages/route.ts
- app/api/messages/recipients/route.ts
- app/api/notifications/route.ts
- app/users/[username]/page.tsx
- app/page.tsx

### Why this approach

RLS only succeeds when application access patterns match policy intent. These refactors were required to preserve behavior while preventing accidental overexposure of profile data or failures caused by newly restricted tables.

## 6. Storage Policy Hardening

### What changed

Storage write policies were tightened so authenticated users no longer have overly broad object write access.

- club avatar writes are restricted to users who can manage the target club
- book cover writes are restricted to admins

A helper function was added:

- `can_manage_club_avatar_object(text)`

### Files involved

- supabase/migrations/20260415190000_storage_policy_hardening.sql

### Why this approach

Previous storage permissions were acceptable for prototyping but too broad for production. Object-path-aware checks make bucket access match actual domain ownership rules.

## 7. Runtime and Build Hardening

### What changed

Production safety rails were restored in the app runtime and build configuration.

- production Supabase env configuration now fails fast when required variables are missing
- Next.js build-time lint and type bypasses were removed
- surfaced TypeScript and hook issues were fixed rather than hidden

### Files involved

- lib/supabase-config.ts
- next.config.mjs
- app/profile/edit-lists/page.tsx
- components/suggestion-review-card.tsx
- components/book-grid.tsx
- lib/cover-cache.ts
- app/api/messages/[id]/route.ts
- app/actions/follow.ts
- app/actions/suggestions.ts
- app/actions/track-reading.ts

### Why this approach

Deployment safety depends on failing early. Missing env vars, ignored type errors, and ignored lint warnings all increase production risk. Re-enabling checks forced the codebase back into a state that can be trusted during build and release.

## 8. Operational Notes

### Supabase CLI and project linkage

During release preparation, the local Supabase CLI was updated and the workspace was linked to the hosted project. The link step surfaced config drift between local auth settings and the hosted project configuration, especially around redirect URLs and auth-related settings.

This branch does not treat those generated temporary linkage files as application source of truth. They should be reviewed independently before deciding whether any of them belong in version control.

### Recommended rollout considerations

Before production rollout:

1. confirm hosted auth redirect URLs match the deployment environment
2. verify MFA, email, and auth configuration drift intentionally
3. apply database migrations in order
4. verify storage policies after deployment
5. smoke-test onboarding, messaging, reviews, discussions, clubs, and suggestion moderation under real auth sessions

## 9. Validation Outcome

This branch previously completed local validation with the stricter checks enabled:

- lint passes
- build passes
- TypeScript issues surfaced by the restored checks were resolved
- RLS coverage was expanded across all public tables in scope

## 10. Commit Strategy for This Branch

The branch is being prepared for review in logical batches so the history reflects the actual implementation phases:

1. onboarding feature and routing
2. onboarding schema persistence
3. RLS migrations and security policy rollout
4. application refactors required by RLS
5. runtime/build hardening and cleanup
6. branch documentation

This structure keeps reviewable units coherent while still preserving the true dependency chain between product changes and security hardening.
