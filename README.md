# English Mode

Responsive PWA personal AI English coach for Turkish-speaking professionals — voice-first,
adaptive, and continuous across sessions. The product specification
(`English_Mode_PRD_v1.md`) is kept locally and is not part of this repository.

> **Status: Milestone 7 — spoken coach, listening and pronunciation.** The Pronunciation lab
> scores read-aloud sentences with Azure pronunciation assessment (overall, accuracy, fluency,
> completeness; prosody for en-US only, otherwise shown as unavailable), per word and per IPA
> sound, with Turkish tips for sounds Turkish speakers commonly substitute. Sentences come from
> built-in practice sets, the learner's phrase pool or their own text. Coach turns show a
> Turkish translation and "İpucu" suggests sentence frames and words for the next answer.
> Milestone 7a: coach turns can be read aloud
> (Azure neural TTS, American or British voice, normal or slow); voice mode sends a recorded
> turn as heard and plays the reply, and "Listen first" hides the text until revealed. The
> Listening page offers Claude-generated dictation (word-level, server-side grading) and
> two-voice dialogues with multiple-choice questions. TTS only speaks server-owned text.
> Built on Milestone 6 — voice recordings: Record in chat, reviews and assignments; the
> browser converts to 16 kHz mono WAV, Azure AI Speech fast transcription returns the text, and
> the learner corrects it before sending (stored as `speech_transcript`). Raw audio is never
> stored. Built on Milestone 5 — PWA hardening: Installable PWA with an offline page and
> connectivity banner, error boundaries, security headers, AI burst rate limits, server error
> telemetry, full data export and account deletion. Built on Milestone 4: Claude text coach with grounded
> feedback, career/founder/client/social roleplays with an evidence-based rubric debrief, a
> deterministic daily assignment planner (submit, skip, reschedule, swap), a writing coach with
> revision exercises, a baseline + fortnightly matched written assessment, FSRS reviews and
> progress analytics. No demo content remains.

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
`src/lib/scenarios/catalog.ts` with `scripts/generate-scenario-seed.ts`; the app reads
scenarios from the database.

## AI coach

- `src/lib/ai/prompts/` — versioned coach and analyzer instructions (`COACH_PROMPT_VERSION`,
  `ANALYZER_VERSION`, stored with every session/feedback).
- Coach turns: `claude-opus-5-5`, effort `low`, text-only history, learner context frozen per
  session (stable system prefix → prompt caching). Server-side refusal fallback is enabled
  (`fallbacks: "default"`).
- Analyzer: effort `medium`, structured output validated with Zod, then
  `validateFeedback()` drops any finding not anchored to a real learner message/quote and caps
  corrections at 3. For roleplays it also rates each scenario rubric criterion
  (`not_observed` / `developing` / `solid` / `strong`) and each goal; a positive rating without a
  cited learner message is downgraded.
- Writing coach, assignment feedback and the baseline assessor (`src/lib/ai/prompts/writing.ts`,
  `assessment.ts`) share `runStructured()`; every correction must quote the learner's own text,
  and assessment ratings need a quote from that answer. Levels are an informal, written-only
  CEFR-like range, never an official result.
- Daily plan: `src/lib/assignments/planner.ts` is pure and deterministic (PRD §12 default:
  5 min retrieval + conversation/roleplay + 5 min recap; a 5-minute day is one task). Rows are
  keyed by `plan_key`, so regeneration is idempotent; each analyzed session adds one follow-up.
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
src/lib/scenarios/    catalog (seed source), DB mapping and queries
src/lib/assignments/  daily planner (pure) and assignment service
src/lib/writing/      writing coach entries and revisions
src/lib/assessment/   baseline task set, matched-task scheduling, assessor service
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
| 1   | Supabase schema + RLS + tests, auth, onboarding | ✅     |
| 2   | Text AI coach end-to-end, feedback analyzer     | ✅     |
| 3   | Learning pool, FSRS reviews                     | ✅     |
| 4   | Scenarios, assignments, writing coach, baseline | ✅     |
| 5   | PWA hardening, deployment                       | ✅     |
| 6   | Recorded voice + transcription                  | ✅     |
| 7a  | Spoken coach (TTS), voice mode, listening       | ✅     |
| 7b  | Pronunciation lab, translations, hints          | ✅     |
| 8   | Adaptive planning, notifications                |        |

## Known limitations

- Coach replies are not streamed yet. Rate limits cover Claude calls only (20/min, 150/10 min
  per learner; no daily cap by design).
- The service worker never caches pages or API data (privacy); offline you get a static
  "You're offline" page, and soft navigations resume when the connection returns.
- Voice needs `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`; without them recording works but the
  server answers "not configured" and text input stays available. The real Azure test
  (`tests/integration/azure-speech.test.ts`, synthetic `say` recording) runs once a key is set;
  `E2E_REAL_VOICE=1` runs the browser flow against Azure.
- Voice requires the voice-processing consent at version `2026-11-v2` (names Azure as the
  subprocessor); older grants are asked again. Recordings are capped at 2 minutes.
- Voice mode is turn-based (record → transcribe → Claude → TTS, a few seconds per turn), not a
  realtime duplex call: Claude has no realtime voice API, so the PRD's OpenAI Realtime plan was
  replaced to keep one coach. TTS is billed per character (`ai_usage_logs.characters`) and
  counts toward the same burst limits. Settings → Microphone picks the recording input.
- Listening exercises and pronunciation attempts are not yet part of the daily assignment plan
  or progress charts.
- Pronunciation scores are Azure's automatic estimate against its native-speaker model, shown
  with that caveat. en-GB assessment returns sound-level scores without sound names, so the lab
  shows word-level results and says so (en-US gives IPA sounds and prosody). Recordings are
  capped at 30 s and not stored.
- Rate limits: Claude 20/min and 150/10 min; Azure speech (transcription, TTS, pronunciation)
  separately 60/min and 400/10 min, since practice comes in bursts. Translations and hints use
  `AI_FAST_MODEL` (default `claude-haiku-5-5`).
- The baseline assessment is still text-only.
- Review assignments are completed with "Mark done" once at least one card was graded that day;
  conversation/roleplay assignments complete when the linked session ends with a learner reply.
- Settings → "Your data": JSON export of every learner-owned row and typed-confirmation
  account deletion (cascades through all tables, including listening exercises; no audio
  objects are stored).
- The Supabase project runs in `us-east-1`.
- Unknown dynamic IDs render the not-found page; with partial prerendering the HTTP status may
  remain `200` once streaming has started (documented Next.js behavior, `noindex` is still set).

## Deployment

Vercel project `english-mode` (team `bluechip2`). Production env vars: Supabase (Marketplace
integration), `ANTHROPIC_API_KEY`, `ALLOWED_EMAILS`. Deploy with `vercel deploy --prod`; then
sign in at the production URL with the account created by `pnpm user:create`.
