# Public-domain reader

## Goal

Let readers open eligible public-domain works from the canonical `/titles/[id]` page without reviving the removed `/books` routes or legacy `book_contents` model.

## Required product rules

- A title is readable only when its full text source and public-domain status have been verified.
- The server, not only the interface, enforces title eligibility.
- Text provenance, source URL, edition, jurisdictional note, and ingestion timestamp remain auditable.
- Reading position belongs to the signed-in reader and cannot be read or changed by another account.
- Titles without approved full text never display an active reader link.

## Implementation outline

1. Add a canonical title-text source model with eligibility and provenance fields.
2. Add an authorized reader route below `/titles/[id]` and a conditional action on the title page.
3. Rework the archived page-turning prototype with scoped styles and committed, licensed assets.
4. Add responsive, keyboard, screen-reader, reduced-motion, and plain-reading-mode support.
5. Persist reading position and connect it deliberately to the existing diary/progress model.
6. Protect eligibility and reader progress with validation, server checks, RLS, and browser tests.

## Acceptance criteria

- An eligible seeded public-domain title can be opened and resumed locally without an external runtime dependency.
- An ineligible title and a direct route request are denied consistently.
- Reader styling cannot change unrelated application pages.
- Source/licensing information is visible and stored with the text record.
- Keyboard navigation, reduced motion, mobile layout, and progress persistence are covered by tests.

The preserved interaction reference is in `docs/archive/prototypes/public-domain-reader/`. It must not be enabled directly.
