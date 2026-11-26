# TanStack Start migration contract

For the current port order, staging setup, and release gates, see [TanStack Start cutover readiness — 25 November 2026](tanstack-start-cutover-readiness-2026-11-25.md).

The working Start preview is in `apps/start`. It has its own dependency lockfile and runs on port 3101, while the current Next app continues on port 3000. The preview now includes the public home, catalog search/detail, community/club views, public profiles, authenticated messages, onboarding, notifications, the signed-in profile overview and list manager, and the private reading diary. Google-only sign-in/callback/logout, request-scoped Supabase auth, React Query SSR hydration, intent prefetch, CSP nonces, private cache headers, bounded writes, and cross-origin write rejection are wired. The preview remains `noindex`; it is not yet a replacement site.

Current blockers to staging acceptance are the remaining avatar upload, club-management, and staff routes and mutations, prepared responsive image variants, and full signed-in browser/RLS journeys. The first-time `/onboarding` flow creates the authenticated profile and default reading lists, validates a unique username, saves favorite genres, and completes setup. Its optional title-selection and reader-suggestion steps remain deferred. Notifications preserve private cursor pagination, unread counts, read-state mutations, and authenticated club-invitation responses. The signed-in profile overview scopes all reads to the authenticated profile and binds username/bio updates to the same auth identity through a bounded server writer. The list manager adds maintained local catalog titles, automatically enforces one default reading state, and caps custom lists and list sizes. Its Start mutations already use the server-only writer after authenticated ownership checks; final cutover must revoke direct browser DML on `title_lists` and `title_list_items` after the legacy Next writers are retired. External catalog ingestion remains deferred to its dedicated security boundary. The diary provides SSR-prefetched private timeline/detail views plus bounded progress and note writes; legacy note HTML is reduced to inert text before reaching React, while new notes are stored as escaped compatibility HTML and plain text. The legacy `/track-reading` URL preserves its redirect into catalog search. Google sign-in still needs a fixed staging callback host before an end-to-end acceptance test.

## Route inventory

Preserve these public URLs. File names below are proposed Start route names, not a mechanical conversion rule for every layout.

| URL | Next source | Start route |
| --- | --- | --- |
| `/` | `app/page.tsx` | `routes/index.tsx` |
| `/about` | `app/about/page.tsx` | `routes/about.tsx` |
| `/auth` | `app/auth/page.tsx` | `routes/auth.tsx` |
| `/auth/callback` | `app/auth/callback/page.tsx` | `routes/auth.callback.tsx` |
| `/onboarding` | `app/onboarding/page.tsx` | `routes/onboarding.tsx` |
| `/search-titles` | `app/search-titles/page.tsx` | `routes/search-titles.tsx` |
| `/titles/:id` | `app/titles/[id]/page.tsx` | `routes/titles.$id.tsx` |
| `/track-reading` | `app/track-reading/page.tsx` | `routes/track-reading.tsx` |
| `/community` | `app/community/page.tsx` | `routes/community.tsx` |
| `/community/clubs/:id` | `app/community/clubs/[id]/page.tsx` | `routes/community_.clubs.$id.tsx` |
| `/community/clubs/:id/manage` | `app/community/clubs/[id]/manage/page.tsx` | `routes/community_.clubs.$id_.manage.tsx` |
| `/community/clubs/:id/write` | `app/community/clubs/[id]/write/page.tsx` | `routes/community_.clubs.$id_.write.tsx` |
| `/community/clubs/:id/works/:workId` | `app/community/clubs/[id]/works/[workId]/page.tsx` | `routes/community_.clubs.$id_.works.$workId.tsx` |
| `/diary` | `app/diary/page.tsx` | `routes/diary.tsx` |
| `/diary/:id` | `app/diary/[id]/page.tsx` | `routes/diary.$id.tsx` |
| `/messages` | `app/messages/page.tsx` | `routes/messages.tsx` |
| `/messages/:id` | `app/messages/[id]/page.tsx` | `routes/messages_.$id.tsx` |
| `/notifications` | `app/notifications/page.tsx` | `routes/notifications.tsx` |
| `/profile` | `app/profile/page.tsx` | `routes/profile.tsx` |
| `/profile/edit-lists` | `app/profile/edit-lists/page.tsx` | `routes/profile_.edit-lists.tsx` |
| `/users/:username` | `app/users/[username]/page.tsx` | `routes/users.$username.tsx` |
| `/admin/moderators` | `app/admin/moderators/page.tsx` | `routes/admin.moderators.tsx` |
| `/admin/suggestions` | `app/admin/suggestions/page.tsx` | `routes/admin.suggestions.tsx` |
| `/api/messages` | `app/api/messages/route.ts` | `routes/api.messages.ts` server handlers |
| `/api/messages/:id` | `app/api/messages/[id]/route.ts` | `routes/api.messages.$id.ts` server handlers |
| `/api/messages/recipients` | `app/api/messages/recipients/route.ts` | `routes/api.messages.recipients.ts` server handlers |
| `/api/notifications` | `app/api/notifications/route.ts` | `routes/api.notifications.ts` server handlers |
| `/api/notifications/counts` | `app/api/notifications/counts/route.ts` | `routes/api.notifications.counts.ts` server handlers |
| `/api/notifications/invitation` | club invitation server actions | `routes/api.notifications.invitation.ts` server handlers |
| `/api/profile` | profile server actions | `routes/api.profile.ts` server handlers |
| `/api/profile/lists` | list server actions | `routes/api.profile.lists.ts` server handlers |
| `/api/diary` | diary/progress server actions | `routes/api.diary.ts` server handlers |
| `/api/track-reading/suggestions` | `app/api/track-reading/suggestions/route.ts` | `routes/api.track-reading.suggestions.ts` server handlers |
| `/api/community/clubs/:id/invite-candidates` | `app/api/community/clubs/[id]/invite-candidates/route.ts` | `routes/api.community.clubs.$id.invite-candidates.ts` server handlers |

The paths with `:id`, `:workId`, and `:username` must return the same status for absent records. Record query parameter contracts for search, diary filters, message folders and pagination, community filters, and title lookup before converting each route. Preserve browser back/forward, direct reload, and OAuth callback behavior.

## Security behavior that must survive

1. **Server authority.** Start loaders can run in the browser during navigation. Database service keys, privileged reads, and authorization checks belong in server functions or server routes. Return only fields the browser is allowed to see. Validate inputs and resource ownership again inside every mutation, even when the page is protected.
2. **Sessions.** Keep Google-only Supabase sign-in, refresh and write back auth cookies, and check `auth.getUser()` on the server for private reads and writes. Match cookie name, domain, path, expiry, and logout across the old and new deployments. Preserve onboarding redirects. Admin and moderator operations must retain the protected `user_roles` check and staff authenticator requirement once that release is live.
3. **Private responses.** Personalized HTML, API responses, redirects, and server function results need `Cache-Control: private, no-store, max-age=0` through the selected host and CDN. Do not prerender them. Check after sign-in, sign-out, and account switching.
4. **Browser script policy.** Recreate the request nonce and Content Security Policy in the Start server response and hydration scripts. Keep stored message HTML sanitized at write and read boundaries. Verify an image/event-handler payload cannot execute on the inbox list or detail page.
5. **Write boundaries.** Hosted Supabase RLS and grants remain the final database boundary. Port validated server writers for messages, profiles, rewards, roles, avatars, title ingestion, and clubs before exposing their UI. A Start server function is an HTTP endpoint and must enforce the same limits, CSRF/origin checks where applicable, and quotas.
6. **Images.** Start does not include the Next image optimizer. Serve bounded, prepared WebP variants from Storage with fixed `srcset` choices; keep external image hosts constrained. Remove the old Next image endpoint only after no production route uses it.
7. **Errors and metadata.** Preserve real 401/403/404 statuses, public canonical URLs, Open Graph data, robots behavior, icons, and any sitemap routes. Replace Next `metadata` and `next/font` deliberately. The preview has `noindex` until route parity is established.

## Incremental sequence

1. Keep the current Next app live. Build and run the Start preview locally; verify a direct `/` request and hydration. The isolated `apps/start` package has no Supabase credentials.
2. Implement a request-scoped Supabase SSR adapter and security header middleware. Verify cookie refresh, private cache policy, nonce propagation, and cross-origin mutation rejection with local tests before moving private pages.
3. Move public read-only routes and shared UI first. Compare server HTML, metadata, redirects, query state, images, and 404s against the Next app.
4. Move authenticated routes and server mutations one group at a time. Run existing browser and database boundary journeys against both apps. Test that a signed-out client cannot replay a mutation.
5. Deploy Start to a separate Vercel staging project rooted at `apps/start`. Nitro emits Vercel Build Output API v3 with a Node 22 function. Keep the same Supabase schema compatible with both versions and use a fixed staging hostname for OAuth.
6. Change production traffic to the Start Vercel project only after parity checks, monitor login/error/write rates, and keep the current Next deployment as the rollback target. Retire Next after the rollback window; Vercel remains the host, while the Nitro build stays portable.

## Authentication adapter in progress

The Start preview now has a request-scoped `@supabase/ssr` client and Google-only sign-in, callback, and sign-out endpoints. It uses the same Supabase cookie format as the current Next app. The server adapter writes refreshed cookies to the response and keeps all auth responses private and uncached. Protected future server handlers must call `requireUser` or `requireStaff` inside the handler; a page redirect alone is not an authorization boundary. Staff access checks both the `user_roles` record and AAL2 authenticator assurance.

Set `PUBLIC_APP_ORIGIN` to the exact public origin for this deployment. Production requires HTTPS. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the same Supabase project used by the existing app (the adapter also accepts the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` names). Register `${PUBLIC_APP_ORIGIN}/auth/callback` in Supabase's allowed redirect URLs before testing Google sign-in on a separate host. No service-role key is used by the preview auth routes.

The local preview has verified a same-origin PKCE redirect and hardened HTTP-only auth cookies, safe handling of missing and invalid callback codes, and rejection of cross-origin writes. The onboarding and messages slices verify signed-out redirects, bounded JSON writes, and real 401/404/413 responses. Messages additionally preserve ownership-filtered reads, sanitized rich-text rendering, and quotas. A complete Google sign-in and account-switching test still requires a registered fixed staging callback URL.

## Local commands

From `apps/start`: `pnpm install`, `pnpm build`, `pnpm typecheck`, and `pnpm dev`. The preview is at `http://localhost:3101`. To check the production output, run `PORT=3101 HOST=127.0.0.1 pnpm start` and, in another terminal, `pnpm smoke:security`. The smoke script compares two actual HTTP responses, checks private cache headers and a fresh CSP nonce, and rejects cross-origin and originless API writes.

References: [TanStack's Next.js migration guide](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), [build from scratch](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch), [hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).
