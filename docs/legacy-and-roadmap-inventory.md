# Legacy and roadmap inventory

This inventory records code that is currently unreachable, superseded, or retained for compatibility. Nothing listed here was removed during the Step 3 cleanup. Each item needs an explicit product decision before it is completed, archived, or deleted.

## Planned features that are currently unreachable

### Threaded and titled discussions

Files:

- `components/discussion-form.tsx`
- `components/discussion-list.tsx`
- `components/reply-thread.tsx`

These components describe a richer discussion model with discussion titles, nested replies, reply counts, and likes. They are not imported by the application, and the expected reply/parent schema does not exist.

Two handlers currently simulate success without writing anything:

- `DiscussionForm` validates its fields, but its server action is commented out before it displays “Discussion created successfully.”
- `ReplyThread` displays “Reply posted successfully,” while its create-reply call is only a TODO. Its Like button also has no handler.

The live title-discussion path is separate and functional:

`TitleEngagementTabs` → `DiscussionForum` → `DiscussionPostForm` → `createDiscussionPost`

That live path uses flat title posts, persists them, and enforces read gating in both server actions and Postgres RLS.

Decision required: either deliberately build threaded discussions with migrations, RLS, notifications, server actions, and journey tests, or archive/remove this earlier prototype.

### Animated in-app reader

Files:

- `app/books/[id]/read/reader-client.tsx`
- `app/books/[id]/read/reader.css`

This is a substantial page-turning reader prototype. It is unreachable because `/books/[id]/read` redirects to `/titles/[id]`, and the old `book_contents` table was removed from the active data model. The CSS also depends on remote CodePen assets and changes global root styling.

Decision required: if an in-app reader remains on the roadmap, preserve the product idea but redesign it around a legitimate content/licensing model and the current title architecture. The old implementation cannot simply be re-enabled.

## Superseded interfaces

These files have no imports and are not part of a current route:

- `components/book-grid.tsx`: old catalog grid with a hard-coded `8.4/10` rating.
- `components/search-bar.tsx`: sends old query parameters to `/library`, which now redirects to `/search-titles`.
- `components/book-content-tabs.tsx`: earlier engagement tabs superseded by `TitleEngagementTabs`.
- `components/club-edit-form.tsx`: real but smaller club editor superseded by `ClubManageForm`.

Decision required: retain only if one of these layouts is intentionally returning; otherwise archive/remove them after approval.

## Authentication history

### Kinde compatibility tombstone

`app/api/auth/[kindeAuth]/route.js` contains no Kinde integration. It returns HTTP `410 Gone` and directs callers to `/auth`. The current application uses Supabase Auth and `/auth/callback`.

This route is harmless and may be useful for old external links. Remove it only after deciding that backward compatibility with earlier deployments is no longer needed.

### Historical migration script

`scripts/003-migrate-to-supabase-auth.sql` is a one-time Kinde-to-Supabase migration. It is not part of any package script and now conflicts with current username/onboarding invariants. It should not be presented as a runnable setup step.

Decision required: archive it as historical implementation context or remove it after its useful history is captured in the development log.

## Compatibility routes

These routes are small redirects rather than dead features:

| Route | Current behavior | Note |
| --- | --- | --- |
| `/books/[id]` | Redirects to `/titles/[id]` | Preserves old title bookmarks |
| `/books/[id]/read` | Redirects to `/titles/[id]` | Also makes the reader prototype unreachable |
| `/library` | Redirects to `/search-titles` | Currently drops old `q` and `g` parameters |
| `/track-reading` | Redirects to `/search-titles` | Preserves the old `q` query |
| `/api/auth/[kindeAuth]` | Returns `410 Gone` | Explains the Supabase replacement |

Decision required: keep and test these shims if old links matter. If `/library` stays, translate or preserve its old filters.

## Empty and deprecated remnants

These contain no working product implementation:

- `app/actions/book.ts`
- `lib/image-utils.ts`
- `scripts/seed.ts`
- `scripts/backfill-genre-weights.ts`
- `scripts/001-create-tables.sql`
- `scripts/002-seed-books.sql`
- `scripts/004-create-book-contents.sql`
- `scripts/005-create-user-progress.sql`
- `styles/globals.css` (unused duplicate; the application imports `app/globals.css`)

These are the safest cleanup candidates, but they remain untouched until the repository owner approves their removal or archival.
