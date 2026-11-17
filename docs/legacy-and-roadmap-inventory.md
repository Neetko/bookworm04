# Legacy and roadmap inventory

This inventory records code that is currently unreachable, preserved for future work, or retained for compatibility. It also records cleanup decisions already approved by the repository owner so removed code is not mistaken for an accidental loss.

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

- `docs/archive/prototypes/public-domain-reader/reader-client.tsx`
- `docs/archive/prototypes/public-domain-reader/reader.css`
- `docs/archive/prototypes/public-domain-reader/README.md`

This is a substantial page-turning reader prototype. It was moved outside the application route tree when the obsolete `/books` routes were removed. The old `book_contents` table is no longer part of the active data model, and the prototype CSS still depends on remote CodePen assets and changes global root styling.

Product decision: a future reader should launch from canonical `/titles/[id]` pages only for titles with verified public-domain text. The archived README records the implementation requirements. The old implementation must not be re-enabled directly.

## Resolved cleanup decisions

The repository owner approved removal of the following superseded interfaces:

- `components/book-grid.tsx` (superseded catalog grid with a hard-coded rating);
- `components/search-bar.tsx` (superseded by the current Search Titles experience);
- `components/book-content-tabs.tsx` (superseded by `TitleEngagementTabs`);
- `components/club-edit-form.tsx` (superseded by `ClubManageForm`).

The obsolete `/books/[id]`, `/books/[id]/read`, and `/library` redirects were also removed. Search and discovery now use `/search-titles`, and canonical detail pages use `/titles/[id]`.

The Kinde `410 Gone` compatibility route and the historical `scripts/003-migrate-to-supabase-auth.sql` script were removed after confirmation that backward compatibility was unnecessary. Supabase Auth is the only active authentication system.

`/track-reading` remains a small redirect to `/search-titles` and can be reviewed separately.

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
