# Security remediation status — 25 November 2026

## Production state

Bookworm still serves the Next app from `bookworm04.vercel.app`. The TanStack Start app in `apps/start` is an isolated, `noindex` preview; moving frameworks or hosts is not needed to close the confirmed message, private-data, or authentication flaws.

The stored message XSS chain is closed at multiple boundaries. Message writes sanitize HTML and reject empty or oversized sanitized bodies. List previews extract plain text without inserting hostile markup into a browser element. Detail views sanitize again. The live site sends a nonce-based CSP with `script-src-attr 'none'`. Sent messages cannot be edited, only drafts can. The dangerous historical message may remain in storage as evidence but is rendered inert.

The Next image optimizer remains in the live app on patched Next 15.5.29. AVIF output is disabled, the Supabase remote host is restricted to this project's configured host, and an unrelated Supabase host returns HTTP 400 from `/_next/image`. The optimizer is removed as part of the Start cutover, after image delivery is replaced.

Private message and profile reads are scoped by RLS. Message and other account mutations pass through server or database checks; message sending also has a per-account quota. Staff operations require the protected role record and AAL2 authenticator assurance. Hosted auth is Google-only: the public settings endpoint reports Google enabled and email sign-in disabled. OAuth account creation remains enabled by design.

## Verification on 25 November

- Production deployment for main commit `883a8ab` completed successfully; the public home page returned HTTP 200.
- Anonymous Supabase reads returned zero rows from `messages` and `user_profiles`. Requesting `email` from `public_profiles` returned an unknown-column error. Public profile usernames remain intentionally discoverable.
- Signed-out requests to `/messages` and `/admin/moderators` redirected to `/auth`. Their responses carried a nonce CSP and private, no-store caching. An unrelated Supabase image URL was rejected with HTTP 400.
- Both the Next app and Start preview returned **zero production dependency advisories** from `pnpm audit --prod`.
- The full root dependency audit still reports 27 high, 21 moderate, and 2 low advisory records in development and build tooling. These are outside the production dependency tree. They need a separate toolchain refresh; some are tied to the Next/Tailwind build chain that the migration will retire.

The prior clean browser and RLS CI journeys passed on [PR #45](https://github.com/Neetko/bookworm04/pull/45), after the security releases in [PR #43](https://github.com/Neetko/bookworm04/pull/43) and [PR #44](https://github.com/Neetko/bookworm04/pull/44). This verification does not prove that no undiscovered flaw exists.

## Remaining decisions and work

1. **Open messaging and directory.** An authenticated reader can still look up public usernames and send to any username, with a quota of ten sent messages per minute per account. The public profile view includes role labels but excludes email. Restricting first contact to mutual follows would change product behavior; this is a product policy choice, not a route to private mail under the current RLS and sanitization boundaries.
2. **Development toolchain.** Refresh or replace vulnerable lint, test, and build dependencies in a separate PR. Keep the two production audits green. This release adds a CI check for new moderate-or-higher production advisories in either app.
3. **Start migration.** Port data routes and mutations with their server checks, test Google login on a staging callback URL, then plan host cutover and rollback. Keep Next in service until route parity, private response caching, image delivery, and live session switching are verified.
