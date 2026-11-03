@AGENTS.md

# English Mode — project rules

- `English_Mode_PRD_v1.md` is the source of truth. Implement one milestone at a time; stop and
  report after each (checks run, files changed, limitations) before starting the next.
- Never present demo data or canned output as real. Demo content lives in `src/lib/demo/` and is
  always rendered with a visible demo label.
- Never expose provider secrets (Supabase service role, OpenAI, Azure) to client code. Read them
  only via `getServerEnv()` in server code.
- Verify current vendor docs before integrating a provider; never claim an integration works
  without credentials and a real test.
- Database changes: add a migration in `supabase/migrations/`, enable RLS + explicit grants for
  every new table, use composite `(id, user_id)` FKs for owned child rows, extend
  `tests/integration/rls.test.ts`, then `pnpm db:push && pnpm db:types`.
- Server code reads the user only through `src/lib/auth/dal.ts`; never trust a client-supplied
  user_id. Components that read the session must sit inside `<Suspense>` (Cache Components).
- Claude calls live only in `src/lib/ai/` (server-only). Bump the prompt version constant when a
  prompt changes; keep the coach system prefix byte-stable within a session; never replay
  edited history. Tests must not call Claude unless `E2E_REAL_AI=1` (it costs money).
- Use pnpm. Before finishing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`,
  plus `pnpm test:integration` for DB changes and `pnpm test:e2e` for UI changes.
- UI: dark-first, mobile-first (375px), ≥44px touch targets, keyboard focus visible, Turkish for
  short explanations, English for practice content.
