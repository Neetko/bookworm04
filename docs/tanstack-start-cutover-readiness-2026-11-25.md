# TanStack Start cutover readiness — updated 26 November 2026

## Current baseline

The production app is Next.js 15.5.29 on Vercel, and Vercel remains the chosen host. The separate `apps/start` package builds TanStack Start through Nitro. Public home, catalog, title, community, club, and profile views are ported, along with first-time onboarding and an initial private messages read/send slice. React Query SSR hydration and intent prefetch are installed. The preview remains `noindex` and incomplete; the current Next app stays live.

The confirmed security fixes remain in the Next app until cutover. Replacing Next removes its `/_next/image` optimizer only when the new site stops using that endpoint. It does not replace the HTML sanitizer, Supabase RLS, staff assurance checks, Google-only auth configuration, quotas, or private response headers.

## Remaining build order

1. **Shared boundaries.** Extract framework-neutral validation, HTML sanitization, permissions, quotas, and typed data access from Next modules. Keep secrets in Start server code. Add parity checks for status codes, redirects, cache headers, CSP, and cookie refresh.
2. **Finish public parity.** Complete external title ingestion, canonical query normalization, public metadata, and bounded responsive image delivery. Keep the preview `noindex` while incomplete.
3. **Private pages and writes.** Extend onboarding with its optional title/follow steps, then port reading, diary, follows, club management/writing, profile edits, notifications, admin, and the remaining message operations. Check `auth.getUser()` and ownership inside every server handler. Reuse the existing database policies rather than granting Start broader browser access.
4. **Images and assets.** Replace `next/image` with fixed, preprocessed cover and avatar sizes stored in Supabase Storage and explicit responsive sources. The current cover ingestion already produces bounded WebP output and avatar upload resizes to 200px; add the needed cover variants and migrate remote Google/Open Library images before removing the optimizer. Keep remote fetch allowlists, byte and pixel limits, and CSP image hosts constrained. Check image quality, failures, cache policy, and cost in staging.
5. **Vercel staging.** Create a separate Vercel project with `apps/start` as its project root and a fixed staging hostname. CI now verifies Nitro's Vercel Build Output API bundle and Node 22 runtime. Set the exact HTTPS `PUBLIC_APP_ORIGIN`, Supabase public values, and the service-role key required by protected server writers. Register the staging `/auth/callback` in Supabase.
6. **Cutover.** Verify route parity and Google login on staging, then test account switching, RLS, every mutation, signed-out behavior, image delivery, CDN caching, SEO, and real statuses. Keep the existing Next deployment as the rollback target. Move the production domain only after staging passes; Vercel continues hosting the Start deployment.

## Release gates

- Full dependency audits, typecheck, build, unit tests, and browser/RLS journeys pass for Start.
- Public URLs and important query states behave the same on direct load and client navigation; missing resources retain their intended status codes.
- A normal user cannot read another user's messages or private profile, change roles, or write directly to restricted tables. Staff actions require AAL2. Stored hostile message HTML remains inert in list and detail views.
- Personalized HTML, redirects, APIs, and server functions remain `private, no-store` through the selected host. CSP nonces and cross-origin write rejection are verified from actual responses.
- Google callback and logout work on the staging host; sessions are checked after refresh and account switching. No production domain change happens during these tests.
- Image URLs do not invoke `/_next/image` or an unrestricted remote transformation proxy. Storage paths and external hosts are allowlisted, and new variants are bounded at ingestion.
- The production host and domain switch have a documented rollback command and a verified previous release.

## Decisions before an external staging deploy

- Create the separate Vercel project and fixed staging hostname; do not repoint the production project yet.
- Choose a staging Supabase project or controlled test accounts and register the staging Google redirect. Do not use real user data merely to prove the preview works.
- Decide whether the current public username directory and first-contact messaging behavior should remain; the framework migration does not change this policy.

References: [TanStack migration guide](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), [TanStack hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting), [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3).
