# Security remediation status — 25 November 2026

## Production state

Bookworm now serves the TanStack Start app in `apps/start` from `bookworm04.vercel.app`; Vercel remains the host. The previous Next deployment remains available as a temporary rollback target. The framework change was not required to close the confirmed message, private-data, or authentication flaws, which remain protected by application checks, sanitization, quotas, and Supabase policies.

The stored message XSS chain is closed at multiple boundaries. Message writes sanitize HTML and reject empty or oversized sanitized bodies. List previews extract plain text without inserting hostile markup into a browser element. Detail views sanitize again. The live site sends a nonce-based CSP with `script-src-attr 'none'`. Sent messages cannot be edited, only drafts can. The dangerous historical message may remain in storage as evidence but is rendered inert.

The Next image optimizer is no longer in the live request path. TanStack Start serves allowlisted Google Books/Open Library responsive URLs directly and bounded Supabase Storage images without an unrestricted transformation proxy.

Private message and profile reads are scoped by RLS. Message and other account mutations pass through server or database checks; message sending also has a per-account quota. Staff operations require the protected role record and AAL2 authenticator assurance. Hosted auth is Google-only: the public settings endpoint reports Google enabled and email sign-in disabled. OAuth account creation remains enabled by design.

## Verification on 25 November

- Production deployment for main commit `4bebf7d` completed successfully; the public home page returned HTTP 200. The merged main CI checks passed.
- Anonymous Supabase reads returned zero rows from `messages` and `user_profiles`. Requesting `email` from `public_profiles` returned an unknown-column error. Public profile usernames remain intentionally discoverable.
- Signed-out requests to `/messages` and `/admin/moderators` redirected to `/auth`. Their responses carried a nonce CSP and private, no-store caching. An unrelated Supabase image URL was rejected with HTTP 400.
- Both the Next app and Start preview returned **zero production dependency advisories** from `pnpm audit --prod`.
- The full root dependency audit initially reported 27 high, 21 moderate, and 2 low advisory records in development and build tooling. A subsequent isolated toolchain refresh cleared them all; the full audit of both apps now reports zero known advisories. That refresh passed lint, types, 104 unit tests, the Next build, and Drizzle migration checks. CI now audits all dependencies in both apps.

The clean browser and RLS CI journeys passed on [PR #47](https://github.com/Neetko/bookworm04/pull/47), after the security releases in [PR #43](https://github.com/Neetko/bookworm04/pull/43) and [PR #44](https://github.com/Neetko/bookworm04/pull/44). This verification does not prove that no undiscovered flaw exists.

## Remaining decisions and work

1. **Open messaging and directory.** An authenticated reader can still look up public usernames and send to any username, with a quota of ten sent messages per minute per account. The public profile view includes role labels but excludes email. Restricting first contact to mutual follows would change product behavior; this is a product policy choice, not a route to private mail under the current RLS and sanitization boundaries.
2. **Dependency maintenance.** Keep the full dependency audit green in both apps. Several transitive build-tool fixes use newer major versions; check lint, CSS output, schema tooling, and browser journeys after future changes to those packages.
3. **Post-cutover acceptance.** Complete one interactive Google sign-in, logout, and account-switch check on production. Keep the known-good Next deployment available during the observation window, then remove the rollback implementation in a separate cleanup release.
