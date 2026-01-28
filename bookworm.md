We are going to keep track of what the users are reading and reward them accordingly.

ACHIEVEMENTS:

'Would you still love me if I was a worm?' - read ? romance pages
'Hungry Hungry Caterpillar' - have a reading streak of 1 week
'Here be Dragons' - read ? fantasy pages
'Do you have your towel?' - read ? sci-fi pages
'Red Rum' - read ? horror pages



GENRE COLOR SCHEME:

HORROR - RED
ROMANCE - PINK
FANTASY - GREEN
SCI-FI - BLUE
ADVENTURE - YELLOW
MYSTERY - PURPLE
NON-FICTION - CYAN


ONLY READING ON-SITE AVAILABLE CONTENT REWARDS 'genre' PONTS (???)
    


Owners of Book Clubs should be able to:


---

## Dev Log

### 2026-01-18 — Working baseline (branch: `type-safety`)

- **Supabase auth + SSR cookies**: Introduced cookie-aware server client and browser client split; added middleware refresh so server actions/SSR reliably see the session.
	- Added: `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `middleware.ts`
	- Updated imports/usages across actions and client components to use the correct client.

- **Community / Clubs**:
	- Added club categories (genres) + UI selector on create; persisted to `clubs.categories` and displayed on club pages.
	- Added reusable club card UI (member count + category dots + hover details) used on Community page.
	- Implemented club detail page with Members / Planned reading tabs.
	- Added “Apply to club” flow (applications table) and owner-only Manage route.
	- Added owner management: update settings, upload club avatar (Storage), invite/kick members, CRUD planned reading items.

- **Storage uploads**:
	- Added Storage buckets + RLS policies for `club-avatars`, `book-covers`, `user-avatars`.
	- Implemented uploads for club avatars, admin-only book covers, and user avatars; profile edit UI now uploads avatar files.

- **Book content / reader behavior**:
	- Reader no longer falls back to `books.description` as readable text; requires non-empty `book_contents`.
	- Seed script now inserts non-empty placeholder `book_contents` text for local development.

- **Schema / migrations**:
	- Added club-related migrations (categories, avatar_url, applications, reading items) in both Drizzle and Supabase migrations.
	- Enforced one `book_contents` row per book via unique index.
	- Added then removed `read_ready` experiment (migrations retained for history).

- **Tooling / misc**:
	- Tailwind globs scoped to reduce editor/CPU churn; VS Code search/watch excludes updated.
	- Auth modal updated for Dialog accessibility (title/description present).
	- Cleaned up an accidental paste/duplication in the club manage page; `pnpm build` passes.

**Known follow-ups (not done yet):**
- `/books/[id]/read` should hard-404 when book/content missing (currently shows “Not in library”).
- Discussion create actions are still TODOs.
