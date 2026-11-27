# TanStack Start cutover readiness — updated 27 November 2026

## Current state

The application route conversion is complete in `apps/start`. Every public, authenticated, club, writer, messaging, diary, notification, profile, moderator, and suggestion-review route has a TanStack Start equivalent. External Google Books search and reviewed catalog submission are also implemented. The old Next application remains in the repository only as a short-term rollback target.

Vercel remains the host. The isolated `bookworm04-start` project builds from `apps/start` on Node 22 and is available at `https://bookworm04-start.vercel.app`. It remains `noindex`. The production `bookworm04` project has the non-secret TanStack origin, Nitro preset, and indexing settings prepared, but its root directory is not changed until the final merge.

Supabase accepts both production and staging `/auth/callback` URLs. Staging deliberately has only the public Supabase configuration: the production service-role credential was not copied into a second project. The full signed-in writer paths are exercised during the production cutover using the existing protected production environment.

## Completed release gates

- The Start package builds and type-checks on Node 22, and CI verifies Nitro's Vercel Build Output API bundle.
- Existing dependency, unit, Next rollback-build, browser, and local RLS jobs remain required on migration pull requests.
- The real Vercel staging hostname passed the Start security smoke suite: private/no-store responses, fresh CSP nonces, 404 behavior, signed-out redirects, cross-origin rejection, originless-write rejection, and bounded unauthenticated writes.
- Google OAuth initiation on staging produces a PKCE request whose `redirect_to` is the allowlisted staging callback.
- Responsive covers use direct, allowlisted Google Books/Open Library variants or bounded Supabase Storage images. Start does not call `/_next/image` and does not recreate an unrestricted image proxy.
- Messages retain write-time sanitization, inert list previews, read-time sanitization, ownership checks, and quotas. Staff reads and mutations retain role checks plus AAL2 verification.
- External title submission refetches the Google record on the server, bounds the response, deduplicates source mappings, and enters the existing staff-review workflow.

## Final cutover runbook

1. Merge the remaining staff and external-catalog migration branches after required CI passes.
2. Point the existing `bookworm04` Vercel project's root directory at `apps/start`, keeping Node 22, `pnpm build`, and the existing production secrets.
3. Deploy `main`, then verify `/`, catalog search, a missing route, signed-out private redirects, OAuth initiation, and the security smoke suite on `bookworm04.vercel.app`.
4. Perform one Google sign-in and one bounded signed-in mutation. Verify logout and a second account before treating authentication acceptance as complete.
5. Keep the previous Next deployment available as the rollback target during the observation window. Rollback is a Vercel project root/deployment promotion, not a database downgrade.

## Security invariants after cutover

- Service-role credentials remain server-only and only narrow handlers use them after checking the authenticated user and owned resource.
- Supabase RLS, grants, constraints, and transactional functions remain the final data boundary; changing frameworks does not replace them.
- Personalized responses stay private and uncached, and the browser CSP uses a fresh nonce with inline event handlers disabled.
- Hosted authentication remains Google-only. Staff access still requires an admin/moderator role and a verified AAL2 session.
- The staging deployment remains `noindex`; production is indexable only because its explicit build-time setting is `false`.

References: [TanStack migration guide](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), [TanStack hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting), [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3).
