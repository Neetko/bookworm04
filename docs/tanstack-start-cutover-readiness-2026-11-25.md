# TanStack Start cutover readiness — 25 November 2026

## Current baseline

The production app is Next.js 15.5.29 on Vercel. The separate `apps/start` package builds a Node/Nitro TanStack Start preview with a placeholder home page, a public About page, Google-only sign-in/callback/logout, request-scoped Supabase cookies, a CSP nonce, private cache headers, and cross-origin write rejection. It is `noindex` and has no private data pages or application mutations. The current Next app has 23 page routes and 7 API routes; the [migration contract](tanstack-start-migration.md) lists each URL.

The confirmed security fixes remain in the Next app until cutover. Replacing Next removes its `/_next/image` optimizer only when the new site stops using that endpoint. It does not replace the HTML sanitizer, Supabase RLS, staff assurance checks, Google-only auth configuration, quotas, or private response headers.

## Build order for the next task

1. **Shared boundaries.** Extract framework-neutral validation, HTML sanitization, permissions, quotas, and typed data access from Next modules. Keep secrets in Start server code. Add parity checks for status codes, redirects, cache headers, CSP, and cookie refresh.
2. **Public pages.** Replace the placeholder home page; port title search and title detail, community read views, user profiles, and their metadata. Preserve URL and query behavior. Keep the preview `noindex` while incomplete.
3. **Private pages and writes.** Port onboarding, reading, diary, follows, clubs, profile edits, notifications, and messages. Check `auth.getUser()` and ownership inside every server handler. Bring over the message sanitizer at write and read boundaries and the staff role plus AAL2 checks. Reuse the existing database policies rather than granting Start broader browser access.
4. **Images and assets.** Replace `next/image` with fixed, preprocessed cover and avatar sizes stored in Supabase Storage and explicit responsive sources. The current cover ingestion already produces bounded WebP output and avatar upload resizes to 200px; add the needed cover variants and migrate remote Google/Open Library images before removing the optimizer. Keep remote fetch allowlists, byte and pixel limits, and CSP image hosts constrained. Check image quality, failures, cache policy, and cost in staging.
5. **Staging host.** Render's Node/Nitro service is a practical non-Vercel staging candidate, not a committed hosting choice. Build from `apps/start` with its lockfile, Node 22, Nitro's Render preset, and the existing `pnpm build` / `pnpm start` scripts. Set the exact HTTPS `PUBLIC_APP_ORIGIN` and Supabase URL/publishable key as environment values. Register that origin's `/auth/callback` in Supabase. Keep service-role credentials out of the preview until a route requires them.
6. **Cutover.** Verify route parity and Google login on staging, then test account switching, RLS, every mutation, signed-out behavior, image delivery, CDN caching, SEO, and real 401/403/404 responses. Keep the Next site available as a rollback target. Switch the production domain only after the staging checks pass; monitor auth, writes, error rates, and cache behavior before retiring Next and Vercel.

## Release gates

- Full dependency audits, typecheck, build, unit tests, and browser/RLS journeys pass for Start.
- Public URLs and important query states behave the same on direct load and client navigation; missing resources retain their intended status codes.
- A normal user cannot read another user's messages or private profile, change roles, or write directly to restricted tables. Staff actions require AAL2. Stored hostile message HTML remains inert in list and detail views.
- Personalized HTML, redirects, APIs, and server functions remain `private, no-store` through the selected host. CSP nonces and cross-origin write rejection are verified from actual responses.
- Google callback and logout work on the staging host; sessions are checked after refresh and account switching. No production domain change happens during these tests.
- Image URLs do not invoke `/_next/image` or an unrestricted remote transformation proxy. Storage paths and external hosts are allowlisted, and new variants are bounded at ingestion.
- The production host and domain switch have a documented rollback command and a verified previous release.

## Decisions before an external staging deploy

- Confirm the non-Vercel host (Render is the default candidate), service region, and acceptable monthly cost.
- Choose a staging Supabase project or controlled test accounts and register the staging Google redirect. Do not use real user data merely to prove the preview works.
- Decide whether the current public username directory and first-contact messaging behavior should remain; the framework migration does not change this policy.

References: [TanStack migration guide](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), [TanStack hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting), [Render Blueprint specification](https://render.com/docs/blueprint-spec).
