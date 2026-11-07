-- English Mode — Milestone 7a: listening practice and spoken coach replies.
--
-- Listening exercises are generated and graded by the server (secret key);
-- learners can read and delete their own but never write content or scores.

-- Text-to-speech usage is billed per character, not per token or second.
alter table public.ai_usage_logs add column characters integer;

create table public.listening_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  kind text not null check (kind in ('dictation', 'comprehension')),
  -- Generated material, including the answer key.
  content jsonb not null,
  generator_version text not null,
  dialect text not null check (dialect in ('en-US', 'en-GB')),
  -- Learner answers and server-side grading, set once on submission.
  answers jsonb,
  result jsonb,
  score numeric check (score between 0 and 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

alter table public.listening_exercises enable row level security;

revoke all on public.listening_exercises from anon, authenticated;
grant select, delete on public.listening_exercises to authenticated;

create policy "listening_exercises: read own" on public.listening_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "listening_exercises: delete own" on public.listening_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

create index listening_exercises_user_time_idx
  on public.listening_exercises (user_id, created_at desc);
