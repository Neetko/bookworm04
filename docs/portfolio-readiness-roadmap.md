# Portfolio readiness roadmap

## Delivery rule: one product, one implementation

Portfolio work must improve the maintained Bookworm application, not create a separate demo-only version.

- Runtime pages, components, server actions, database migrations, authorization rules, and tests belong to the main product.
- Demo-only differences are limited to deterministic fixture data, locally optimized fixture assets, and environment-specific authentication configuration.
- A bug fix or feature must not exist only in `supabase/seed.sql` or behind a demo-specific code path.
- Important journeys must work for both the seeded reviewer account and a newly created account.
- Before release, the same migrations and application commit must be deployed together and checked with read-only hosted smoke tests.

The local seed is a presentation layer over the real application: it supplies representative titles, readers, clubs, and activity, but it does not replace product behavior.

## Completed foundation

1. **Reproducible local showcase** — documented setup, local authentication, deterministic data, optimized covers, and a one-command database rebuild.
2. **Protected critical journeys** — onboarding, reading state, diary progress, review/discussion gating, private routes, and direct database rejection tests.
3. **Maintainability and lifecycle hardening** — CI, reusable domain helpers, approved legacy cleanup, transactional club workflows, notification hardening, and consolidated engineering documentation.

## Step 4: showcase release and reviewer experience

### Goal

A hiring reviewer should understand the product, open a working deployment, recognize the engineering depth, and reproduce it locally without needing guidance from the author.

### Work order

1. **Integrate the portfolio branch**
   - review the complete branch diff against `main`;
   - resolve any drift without discarding newer product work;
   - open a focused pull request and require the existing CI checks;
   - merge only after the hosted migration/deployment plan is confirmed.

2. **Create a reliable hosted showcase**
   - deploy the same Next.js application and Supabase migrations used locally;
   - configure production-safe Google authentication and redirect URLs;
   - retain guest browsing so reviewers can see value before signing in;
   - do not publish the local fixture password or local service-role credentials;
   - run the read-only production smoke suite against the deployment URL.

3. **Make the repository tell the story quickly**
   - lead the README with a concise product statement, live-demo link, screenshots, and key capabilities;
   - include a small architecture diagram covering browser, Next.js server boundaries, Supabase Auth/Postgres/RLS, and external catalog sources;
   - explain the most valuable engineering decisions and trade-offs rather than listing every dependency;
   - keep local setup, verification commands, demo behavior, and hosted OAuth requirements easy to find.

4. **Capture trustworthy visual evidence**
   - add current desktop and mobile screenshots from the real application;
   - show the catalog, title engagement, diary/progress, community feed, and club workflow;
   - optimize and commit the images so GitHub loads quickly;
   - avoid mockups that display behavior the application does not actually support.

5. **Prepare the interview narrative**
   - document the problem, architecture, security model, testing strategy, and hardest trade-offs;
   - identify two or three code paths suitable for a technical walkthrough;
   - keep known limitations explicit and pair each with a concrete next implementation.

6. **Finish repository hygiene**
   - verify the license, environment template, secret scanning, issue backlog, and branch protection expectations;
   - remove broken links and stale setup claims;
   - tag a showcase release after CI and hosted smoke checks pass.

### Exit criteria

- The portfolio commits are merged into `main`, and the working tree is clean.
- CI passes from a fresh checkout.
- A public deployment loads without configuration errors and guest browsing works.
- Hosted sign-in succeeds with correctly configured OAuth, while local setup remains OAuth-independent.
- The README contains a live link, current screenshots, architecture, setup, tests, and honest limitations.
- The deployed database schema matches the committed migrations.
- The reviewer journey is checked on desktop and mobile, including a signed-out visit and one authenticated path.

## Later production hardening

These are valid backlog items but do not block beginning Step 4:

- ownership transfer and deliberate club deletion;
- invitation expiry;
- member ban or rejoin-cooldown support;
- a durable outbox for email or push delivery;
- notification event-type constraints after auditing historical production values;
- a dedicated writer-club authoring browser journey.
