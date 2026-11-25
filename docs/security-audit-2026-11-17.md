# Bookworm security review — 17 November 2026

> Historical snapshot. The release status below reflects the initial review, not the current production state. See [Security remediation status — 25 November 2026](security-remediation-status-2026-11-25.md) for verified fixes and remaining work.

## Scope and limits

Static review of the Next.js application, message API, exposed HTML sinks, selected service-role call sites, Supabase migrations, and production dependency advisories. The previously prepared message XSS patch passed local checks. This review did not inspect production logs, deployed database policy state, or the malicious message payload beyond the supplied report. Source findings do not establish that private data was exfiltrated.

## Immediate release status

- The message XSS hotfix is committed as `f6f592f` on `codex/security-xss-hotfix` and pushed to GitHub. It is not merged or deployed.
- The GitHub integration returned 403 for branch, tree, and PR writes. The CLI GitHub login is invalid. A separate attempt to read a stored credential was rejected by automatic approval review and was not performed.
- This branch contains additional local hardening and dependency updates. It is not deployed.

## Findings

| Priority | Finding | Evidence | Status |
| --- | --- | --- | --- |
| Critical | Stored XSS in private messages, including inbox preview. An ordinary account can send active markup; existing stored content also needs a safe display boundary. | `app/api/messages/route.ts`, `components/messages/message-list.tsx`, `components/messages/message-detail.tsx` | Patched in hotfix branch; production pending. |
| Critical | Next 15.2.8 is in the affected range for AVIF image optimization RCE ([vendor advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)). The app enabled AVIF and accepted any `*.supabase.co` remote image host. The supplied HTTP checks show a reachable optimizer, but do not alone prove code execution. | `package.json`, `next.config.mjs` | Locally updated to Next 15.5.29; AVIF output disabled and Supabase host narrowed to the configured project. Production pending. |
| High | Direct `sharp` 0.33.5 dependency has image-processing advisories; user-supplied avatars pass through Sharp. | `package.json`, `lib/avatar-image.ts`; [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Locally updated to 0.35.5; production pending. |
| Medium | Sender can modify an already sent message through `PATCH /api/messages/[id]`, changing a recipient's record after delivery. | `app/api/messages/[id]/route.ts` | Locally restricted content edits to drafts; production pending. |
| Medium | The `public_profiles` view grants anonymous reads of all profile IDs, usernames, avatars, bios, role labels, and timestamps. It does not expose email. The recipient search also permits logged-in users to search users outside their follow graph. | `supabase/migrations/20260415150000_profiles_and_lists_rls.sql`, `app/api/messages/recipients/route.ts` | Confirmed exposure; decide whether a public user directory is intended. Restrict the view or redesign discovery if it is not. |
| Medium | Authenticated users can update their own `user_profiles` row, including the public `role` label. Authorization uses the separate `user_roles` table, so this does not appear to grant admin access, but it allows a misleading badge. | `supabase/migrations/20260415150000_profiles_and_lists_rls.sql`, `supabase/migrations/20260419121000_staff_roles_user_roles_only.sql` | Confirmed in migrations; restrict client column privileges or enforce role synchronization in the database. |
| Medium | No application rate limits were found on message sending, recipient search, follows, or Google ingestion. This permits spam and resource abuse from ordinary accounts. | `app/api/messages/route.ts`, `app/api/messages/recipients/route.ts`, `app/actions/follow.ts`, `app/actions/google-ingest.ts` | Unpatched. Add per-account and per-IP limits plus payload length caps. |
| Medium | No Content Security Policy was found in Next config or middleware. A CSP would reduce the impact of future XSS but cannot replace output sanitization. | `next.config.mjs`, `middleware.ts` | Unpatched; stage and test a nonce-based policy. |
| Low | Raw search text is interpolated into PostgREST `.or()` filter syntax for public titles. Punctuation can alter the filter grammar. | `app/api/track-reading/suggestions/route.ts`, `lib/server/local-title-search.ts` | Unpatched; parameterize by separate queries or escape PostgREST reserved syntax. |

## Dependency review

After the targeted updates, `pnpm audit --prod` reports 1 low, 18 moderate, and 25 high advisory occurrences. These counts include multiple advisories for the same package and transitive build-tool paths; they are not 25 proven exploitable application flaws. The directly relevant Sharp and Tiptap advisories were addressed locally. Remaining advisories require path-by-path reachability review, especially `zod`; avoid blind major-version upgrades.

## Checks completed

- `pnpm lint`, `pnpm typecheck`, and 75 unit tests pass.
- `pnpm build` passes with Next 15.5.29.
- A Sharp PNG resize smoke check passes with 0.35.5.
- No tracked `.env.local` or Supabase environment file was found. The service-role key remains server-side in the reviewed code.

## Production follow-through

1. Restore an authorized GitHub PR/merge path, merge the XSS hotfix, and verify the deployed commit and inbox behavior using a test account.
2. Release the dependency and image-optimizer hardening next; verify the production version and image behavior.
3. Preserve the malicious message and relevant logs as evidence, then remove or quarantine it after the display fix is live. Inspect admin sessions and outbound activity for evidence of misuse.
4. Confirm production migration state and review public-profile visibility with the product owner before changing discovery behavior.
