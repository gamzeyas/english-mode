# English Mode

Responsive PWA personal AI English coach for Turkish-speaking professionals — voice-first,
adaptive, and continuous across sessions. The product specification
(`English_Mode_PRD_v1.md`) is kept locally and is not part of this repository.

> **Status: Milestone 3 — learning intelligence.** Claude text coach with grounded feedback, an
> editable learning pool, FSRS spaced-retrieval reviews with immutable logs, and progress
> analytics. Scenario detail pages and the daily mission template still show labeled **demo**
> content.

## Stack

Next.js 16 (App Router, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
Claude API (`@anthropic-ai/sdk`) ·
shadcn/ui (Radix) · Zod · Vitest + Testing Library · Playwright · pnpm · Node ≥ 24.

## Run locally

```bash
pnpm install
vercel link            # once; links the Vercel project that owns the Supabase integration
vercel env pull        # writes .env.local (Supabase keys, ALLOWED_EMAILS)
pnpm user:create you@example.com   # once; creates your account (hidden password prompt)
pnpm dev               # http://localhost:3000 → /login
```

There is no public sign-up. Accounts are created with `pnpm user:create` and must also be listed in
`ALLOWED_EMAILS` (Vercel env var) to sign in. Re-running `user:create` resets the password.

| Script                         | What it does                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Development server                                                                          |
| `pnpm build` / `pnpm start`    | Production build / serve                                                                    |
| `pnpm lint`                    | ESLint                                                                                      |
| `pnpm typecheck`               | Generates route types, then `tsc --noEmit`                                                  |
| `pnpm test`                    | Unit tests (Vitest)                                                                         |
| `pnpm test:integration`        | RLS/security tests against the real Supabase project (creates and deletes throwaway users)  |
| `pnpm test:e2e`                | Playwright, desktop + 375px mobile; signs in as a throwaway e2e user, deletes it afterwards |
| `pnpm db:push`                 | Apply `supabase/migrations` to the linked database                                          |
| `pnpm db:types`                | Regenerate `src/types/database.ts` from the database                                        |
| `pnpm user:create <email>`     | Create an account or reset its password                                                     |
| `pnpm format` / `format:check` | Prettier                                                                                    |

First e2e run needs a browser: `pnpm exec playwright install chromium`.

PWA icons are generated from the SVGs in `public/manifest-assets/` with
`node scripts/generate-icons.mjs`. The scenario seed migration is generated from
`src/lib/demo/scenarios.ts` with `scripts/generate-scenario-seed.ts`.

## AI coach

- `src/lib/ai/prompts/` — versioned coach and analyzer instructions (`COACH_PROMPT_VERSION`,
  `ANALYZER_VERSION`, stored with every session/feedback).
- Coach turns: `claude-opus-5-5`, effort `low`, text-only history, learner context frozen per
  session (stable system prefix → prompt caching). Server-side refusal fallback is enabled
  (`fallbacks: "default"`).
- Analyzer: effort `medium`, structured output validated with Zod, then
  `validateFeedback()` drops any finding not anchored to a real learner message/quote and caps
  corrections at 3.
- Durability without a queue: `POST /api/sessions/:id/feedback` is idempotent; a stale lock
  (crashed request) is retried on the next call, failures can be retried by the learner.
- Cost visibility: every call's estimated cost is logged in `ai_usage_logs` (no content). There is
  no daily spend cap (owner's choice); sessions are capped at 40 learner turns and 2000 characters
  per message. Switch models with `AI_CHAT_MODEL` / `AI_ANALYSIS_MODEL`.

## Spaced retrieval (FSRS)

- `src/lib/srs/scheduler.ts` wraps `ts-fsrs` 6 (`DefaultScheduler`, FSRS-7 pinned, desired
  retention 0.9). Cards live as JSON in `learning_items.fsrs_state`; `due_at` is indexed.
- Review flow (`/review`): the prompt shows the Turkish meaning and the example with the phrase
  blanked out (the API never sends the phrase before the attempt) → reveal with a local match
  hint → optional advisory AI check → the learner's own grade (Again/Hard/Good/Easy) decides.
- `apply_review()` (Postgres, security invoker) writes the immutable `review_logs` row and the
  new card state in one transaction; idempotent per `client_request_id`, and a grade computed
  from a stale card state is rejected (`EM409`).
- At most 5 brand-new cards per local day; "mastered" is a reversible label (stability ≥ 21 days).

## Security model

- Every table has RLS; `anon` has no privileges; `authenticated` only gets the operations the app
  performs, per table and per column. Analyzer output, usage logs, audio metadata and push
  subscriptions are server-written only.
- Child rows use composite foreign keys `(parent_id, user_id)`, so a message can never be attached
  to someone else's session, even by a buggy server.
- `src/proxy.ts` refreshes the session and redirects signed-out or non-allowlisted users;
  `src/lib/auth/dal.ts` re-checks on every server read. The secret key is never sent to the
  browser.

## Structure

```
src/app/(auth)/login  email/password sign-in
src/app/onboarding    onboarding + preferences editor
src/app/(app)/        dashboard, conversation, learning-pool, scenarios, progress, writing, assignments, settings
src/proxy.ts          session refresh + optimistic auth redirect
src/lib/auth/         data access layer (getCurrentUser/getProfile), sign-in/out actions
src/lib/supabase/     server + proxy Supabase clients
src/types/database.ts generated from the database (pnpm db:types)
src/app/manifest.ts   PWA web app manifest
src/components/       layout (app shell, bottom nav, side rail), dashboard, conversation, learning, ui (shadcn)
src/lib/demo/         DEMO data (PRD §13 starter profile, scenario templates) — replaced in Milestone 1+
src/lib/learning/     pool queries, mutations, progress stats
src/lib/srs/          FSRS scheduler wrapper, recall prompts/matching
src/lib/review/       due queue, reveal, grading, advisory AI check
src/lib/text/         phrase normalization for dedupe
src/types/domain.ts   domain types aligned with the PRD §8 schema
supabase/migrations/  schema, RLS/grants, scenario seed
tests/integration/    RLS tests against Supabase
tests/unit, tests/e2e
```

## Milestones

| #   | Scope                                           | Status |
| --- | ----------------------------------------------- | ------ |
| 0   | Repo, design system, app shell, demo screens    | ✅     |
| 1   | Supabase schema + RLS + tests, auth, onboarding | next   |
| 2   | Text AI coach end-to-end, feedback analyzer     |        |
| 3   | Learning pool, FSRS reviews                     |        |
| 4   | Scenarios, assignments, writing coach           |        |
| 5   | PWA hardening, deployment                       |        |
| 6   | Recorded voice + transcription                  |        |
| 7   | Realtime voice, pronunciation lab               |        |
| 8   | Adaptive planning, notifications                |        |

## Known limitations

- Scenario detail pages and the daily mission template still render demo content (labeled on
  screen). Coach replies are not streamed yet.
- Baseline assessment (`/assessment`) is deferred to Milestone 4 (it needs the AI evaluator).
- Data export and account deletion arrive in Milestone 5; deleting the auth user already
  cascades every row.
- The Supabase project runs in `us-east-1`.
- Unknown dynamic IDs render the not-found page; with partial prerendering the HTTP status may
  remain `200` once streaming has started (documented Next.js behavior, `noindex` is still set).
