# Branch log: club membership, ingest workflow, and title-page UI

## Summary
This branch delivers three main threads of work:

1. Club membership workflow upgrades
   - Added join policies: open, approval required, invite only.
   - Added club invitations, application review flows, pending-invite handling, and owner notifications.
   - Updated club notifications so resolved invitations no longer remain actionable.
   - Added club current-reading progress visibility for members.
   - Added owner-side invite candidate search and management UI.

2. Google Books ingest performance and UX improvements
   - Split ingest into a strict 2-step wizard: genre selection, then duplicate/work review.
   - Parallelized preview loading and added server-side preview token reuse.
   - Reduced submit-path latency by reusing fetched Google volume data, removing redundant work, and avoiding unnecessary cover warming.
   - Changed Bookworm genre suggestion display from auto-selected chips to border-highlighted suggested genre toggles.

3. Title-page action and shopping UI polish
   - Updated title actions to use compact icon buttons.
   - Added a visual separator between primary reading actions and metadata actions.
   - Reworked the shop row to match the provided V0 pattern with compact Amazon/Audible buttons and tooltips.

## Detailed change log

### A. Club membership workflow overhaul
Files:
- app/actions/clubs.ts
- app/api/community/clubs/[id]/invite-candidates/route.ts
- app/api/notifications/route.ts
- app/community/clubs/[id]/page.tsx
- app/community/clubs/[id]/manage/page.tsx
- app/notifications/page.tsx
- components/club-apply-button.tsx
- components/club-card.tsx
- components/club-manage-form.tsx
- db/schema.ts
- supabase/migrations/20260419130000_club_membership_workflows.sql
- supabase/migrations/20260502110000_notifications_write_policies.sql
- supabase/migrations/20260502113000_club_member_progress_rpc.sql

What changed:
- Added `join_policy` support at schema, migration, action, and UI layers.
- Added `club_invitations` schema and policies.
- Added application review metadata (`reviewed_at`, `reviewed_by_user_id`).
- Added invitation acceptance/decline server actions.
- Added owner-side approval/decline for club applications.
- Added invite candidate API based on friends/follows relationships.
- Added pending applications and invitations to the manage screen.
- Added join-policy badges and invite/apply/open access handling on club pages and cards.
- Added notification writes and notification resolution metadata for invitation lifecycle updates.
- Updated notifications page to show resolved invitation state and in-notification accept/decline actions.
- Added club current-reading member progress RPC and UI rendering.

Why:
- Fix stale invitation notifications.
- Support more realistic membership workflows.
- Give club owners better moderation and member-management tools.
- Surface shared progress for current club reads.

### B. Ingest workflow performance and UX improvements
Files:
- app/actions/track-reading.ts
- components/track-reading-result-list.tsx
- components/genre-toggle-button.tsx
- lib/server/suggestion-approval.ts
- lib/types.ts
- lib/server/roles.ts

What changed:
- Added server-side preview caching with `previewToken` reuse for Google ingest previews.
- Parallelized preview preparation work for suggestions, duplicates, and work matching.
- Refactored ingest UI into a strict 2-step flow.
- Added background duplicate-review loading with error/retry handling.
- Reduced submit latency by reusing `ensureBookFromGoogleVolume()` output and current-user access data.
- Skipped non-essential work on the critical submit path, including synchronous cover warming.
- Parallelized suggestion approval writes and reference ISBN syncing.
- Changed suggested genre indication to genre-colored borders on matching genre toggles.

Why:
- Improve perceived responsiveness.
- Reduce repeated remote fetches and duplicated work.
- Make the ingest flow easier to understand and less blocking.
- Preserve Bookworm assistance without auto-applying genres.

### C. Title actions, read-state backfill, and title-page polish
Files:
- app/actions/title.ts
- app/titles/[id]/page.tsx
- components/mark-read-button.tsx
- components/title-bookmark-button.tsx
- components/title-track-progress-button.tsx
- components/title-editions-dialog.tsx
- components/title-dedupe-dialog.tsx

What changed:
- Added completed-progress backfill when a title is marked read.
- Updated action buttons to compact icon-based variants.
- Switched Editions/Dedupe triggers to ghost-style utility actions.
- Added grouped action layout with a separator between reading actions and title-metadata actions.
- Reworked shopping links into a V0-style inline shop row with tooltips and compact buttons.

Why:
- Keep reading state and progress data aligned.
- Improve title-page affordance and visual hierarchy.
- Match the requested interaction design more closely.

### D. Supporting environment / access cleanup
Files:
- app/actions/profile.ts
- lib/server/roles.ts

What changed:
- Centralized Supabase public env/service-role checks via config helpers.
- Removed unnecessary admin-client reads in role/access and notification update paths where user-scoped server clients are sufficient.

Why:
- Reduce configuration sprawl.
- Keep access patterns aligned with current server-client + RLS behavior.

## Notes
- `supabase/.temp/cli-latest` changed during local tooling use and is not part of the functional feature work.
- The branch contains both feature work and requested UI refinements performed iteratively during review.

## Suggested commit grouping
1. Club membership workflows, notifications, and migrations.
2. Ingest performance / two-step UX / suggested-genre border treatment.
3. Title-page action layout and button polish.
4. Supporting auth/profile/read-progress cleanup.
